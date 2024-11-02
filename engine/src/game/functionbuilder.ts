import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";
import { Optional } from "tift-types/src/util/optional";
import { bindParams } from "../script/parser";
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

const SPECIAL_FIELDS = ["before", "actions", "after", "rules", "templates"];

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
    compile(namespace, id, env, compileFunction);
}

export function compileStrings(namespace : Optional<string>, id : string, env : Env) {
    compile(namespace, id, env, makeStrFunction);
}

export function compileGlobalFunction(id : string, value : string, env : Env, path : Path.Type) {
    const fnDef = getFunctionDef(id);
    if (fnDef) {
        const result = compileFnDef(fnDef, value, env, path);
        env.set(result.name, result.envFn);
    } else if (_.isObject(value)) {
        compileFunctions(undefined, id, env);
    }
}

function compile(namespace : Optional<string>, id : string, env : Env, compiler : Compiler) {
    const obj = getObj(namespace, id, env);
    const scope = getScope(namespace, obj, env);
    compileObj(namespace, obj, scope, compiler);
}


function getObj(namespace : Optional<string>, id : string, env : Env) {
    const path = Path.fromValueList((namespace == undefined)? [id] : [namespace, id]);
    return env.get(path);
}

function getScope(namespace : Optional<string>, obj : Obj, env : Env) : Env {
    const nsEnv = (namespace != undefined)? env.newChild(env.createNamespaceReferences([namespace])) : env; 
    return nsEnv.newChild({"this" : obj}).newChild(obj);
}

function compileObj(namespace : Optional<string>, obj : Obj, scope : Env, compiler : Compiler, path : Path.Type = []) : void {
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
 */
const compileFunction : Compiler = (name, value, scope, obj, path) => {
    //const fullPath = Path.concat(obj["id"], path);
    const fnDef = getFunctionDef(name);
    return fnDef? compileFnDef(fnDef, value, scope, path) : undefined;
}

const compileFnDef = (fnDef : FnDef, value : unknown, scope : Env, path : Path.Type) => {
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