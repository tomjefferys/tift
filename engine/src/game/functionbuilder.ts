import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";
import { Optional } from "tift-types/src/util/optional";
import { PathElementType } from "tift-types/src/path";
import { bindParams, DYNAMIC_ROOT, ClosureEnvResolver } from "../script/parser";
import * as Path from "../path";
import * as RuleBuilder from "./rulebuilder";
import * as _ from "lodash";
import { EnvFn, mkResult } from "../script/thunk";
import { formatString } from "../util/mustacheUtils";


// Use to tag "compiled" strings.  These are strings that contain mustache expressions,
// and should be evaluated as functions.
export const IMPLICIT_FUNCTION = "__IMPLICIT_FUNCTION__";

// Use to tag functions defined in configuration, but aren't implicit string functions
// We need to differentiate these from normal js functions, as they will return
// Result object (rather then the result directly)
export const EXPLICIT_FUNCTION = "__EXPLICIT_FUNCTION__";

const SPECIAL_FIELDS = ["before", "actions", "after", "rules", "templates", "properties"];

const FN_REGEX = /^(\w+)\(([\w, ]*)\)$/;

type FnDef = {
    originalName : string,
    name : string, 
    params : string[]
}

type FnImpl = {
    name : string,
    envFn : EnvFn
}

/**
 * Compiles a function (normal or string).  Returns the function name and the function
 */
type Compiler = (name : string, value : unknown, scope : Env, obj : Obj, path : Path.Type) => Optional<FnImpl>;

export function compileFunctions(namespace : Optional<string>, id : string, env : Env) {
    compile(namespace, id, env, makeCompileFunction(namespace));
}

export function compileStrings(namespace : Optional<string>, id : string, env : Env) {
    compile(namespace, id, env, makeStrFunction);
}

export function compileGlobalFunction(id : string, value : string, env : Env, path : Path.Type) {
    const fnDef = getFunctionDef(id);
    if (fnDef) {
        // Global functions must not be permanently bound to whatever env happens to be the
        // engine's root at compile time (see DYNAMIC_ROOT) - otherwise calling one from a
        // simulated/forked env (see env.ts#ForkManager, used by commandplanner.ts) would read and
        // write the real game instead of the simulation.
        const result = compileFnDef(fnDef, value, DYNAMIC_ROOT, path);
        env.set(result.name, result.envFn);
    } else if (_.isObject(value)) {
        compileFunctions(undefined, id, env);
    }
}

function compile(namespace : Optional<string>, id : string, env : Env, compiler : Compiler) {
    const obj = getObj(namespace, id, env);
    const scope = getScope(namespace, obj, env);
    compileObj(namespace, obj, scope, compiler, []);
}


function getObj(namespace : Optional<string>, id : string, env : Env) {
    const path = Path.fromValueList((namespace == undefined)? [id] : [namespace, id]);
    return env.get(path);
}

function getScope(namespace : Optional<string>, obj : Obj, env : Env) : Env {
    const nsEnv = (namespace != undefined)? env.newChild(env.createNamespaceReferences([namespace])) : env;
    return nsEnv.newChild({"this" : obj}).newChild(obj);
}

function compileObj(
        namespace : Optional<string>, obj : Obj, scope : Env, compiler : Compiler,
        path : Path.Type = []) : void {
    const pathRoot = (path.length)? path : [...(namespace? [Path.namespace(namespace)] : []), obj["id"]];
    Object.entries(obj)
          .forEach(([name, value]) => {
            if (path.length || !SPECIAL_FIELDS.includes(name)) {
                const fullPath = Path.concat(pathRoot, name);
                const fnImpl = compiler(name, value, scope, obj, fullPath);
                if (fnImpl) {
                    obj[fnImpl.name] = fnImpl.envFn;
                } else if (_.isObject(value)) {
                    // At this point add the object id ot the path
                    compileObj(namespace, value, scope.newChild(value), compiler, fullPath);
                }
            }
          })
}

const makeStrFunction : Compiler = (name, value, scope, obj) => {
    let result : Optional<FnImpl> = undefined;
    if (_.isString(value)&& !getFunctionDef(name) && value.includes("{{")) {
        const envFn = Object.assign(
            (_env : Env) => mkResult(formatString(scope, value, [obj, name])),
            {[IMPLICIT_FUNCTION] : true}
        );
        result = { name, envFn }
    }
    return result;
}

/**
 * functions can be defined as
 * myFunc(): print("hello world")
 * add(var1, var2): var1 + var2
 *
 * Every function - whether defined directly on an entity or on some sub-object nested within it
 * (eg `child: { "foo()": ... }`) - gets its scope ("this", the entity's own fields, and any
 * nested objects on the path down to the function) re-resolved fresh from the CALLER's own root
 * each time it's called, rather than closing over the specific (possibly stale, possibly
 * real-not-simulated) object captured at compile time - see makeDynamicScope. This is what makes
 * it safe to call any function from a simulated/forked env (see env.ts#ForkManager, used by
 * commandplanner.ts#createPlan): reads see the simulated state and writes land in the fork's
 * overlay, never the real object graph.
 */
function makeCompileFunction(namespace : Optional<string>) : Compiler {
    return (name, value, _scope, _obj, path) => {
        const fnDef = getFunctionDef(name);
        if (!fnDef) {
            return undefined;
        }
        // The path to the function itself, minus any leading namespace element and the
        // trailing function-name element, is the entity id followed by the chain of nested
        // property names leading to the object that owns this function.
        const [id, ...nestedProps] = path
            .filter(element => element.type !== "namespace")
            .slice(0, -1)
            .map(element => element.getValue());
        const closureEnv = makeDynamicScope(namespace, id as string, nestedProps);
        return compileFnDef(fnDef, value, closureEnv, path);
    }
}

// Builds a closureEnv resolver (see script/parser.ts#ClosureEnvResolver) that re-resolves the
// entity (by namespace + id), walks down `nestedProps` (the chain of nested object properties
// leading to the object the function was defined on, empty for a function defined directly on
// the entity), and rebuilds the scope fresh from whatever root the calling env belongs to - so a
// method called from a simulated/forked env (see env.ts#ForkManager, used by commandplanner.ts)
// sees "this" (and any nested objects on the path) as the simulated versions, not the real ones
// captured when the method was originally compiled. The trailing .newChild() is required by the
// ClosureEnvResolver contract (see parser.ts) - it stops params/locals being defined directly
// onto the entity/sub-object itself (getScope's returned scope's properties ARE the live
// object), which would otherwise corrupt real game state.
function makeDynamicScope(namespace : Optional<string>, id : string, nestedProps : PathElementType[]) : ClosureEnvResolver {
    return (env : Env) => {
        const root = env.getRoot();
        let obj = getObj(namespace, id, root);
        let scope = getScope(namespace, obj, root);
        for (const prop of nestedProps) {
            obj = obj[prop] as Obj;
            scope = scope.newChild(obj);
        }
        return scope.newChild();
    };
}

const compileFnDef = (fnDef : FnDef, value : unknown, scope : Env | ClosureEnvResolver, path : Path.Type) => {
    let envFn : EnvFn;
    if (_.isFunction(value)) {
        // Could be implicitly defined function (no compilation needed)
        envFn = value;
    } else {
        // Else compile the function
        const thunk = RuleBuilder.evaluateRule(value, path);
        envFn = (env) => thunk.resolve(env);
    }
    return {
        name : fnDef.name, 
        envFn : Object.assign(
                    bindParams(fnDef.params, envFn, scope),
                    {[EXPLICIT_FUNCTION] : true}
        )
    }
}

function getFunctionDef(str : string) : Optional<FnDef> {
    const match = FN_REGEX.exec(str);
    let result = undefined;
    if (match) {
        const name = match[1];
        const params = match[2] ? match[2].split(",").map(param => param.trim()) : [];
        result = {originalName : str, name, params};
    }
    return result;
}