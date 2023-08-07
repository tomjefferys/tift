import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";
import { Optional } from "tift-types/src/util/optional";
import { bindParams } from "../script/parser";
import * as Path from "../path";
import * as RuleBuilder from "./rulebuilder";
import * as _ from "lodash";
import { EnvFn, mkResult } from "../script/thunk";
import { formatString } from "../util/mustacheUtils";


export const IMPLICIT_FUNCTION = "__IMPLICIT_FUNCTION__";

const SPECIAL_FIELDS = ["before", "actions", "after", "rules"];

const FN_REGEX = /^(\w+)\(([\w, ]*)\)$/;

type FnDef = {
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
type Compiler = (name : string, value : unknown, scope : Env, obj : Obj) => Optional<FnImpl>;

export function compileFunctions(namespace : Optional<string>, id : string, env : Env) {
    compile(namespace, id, env, compileFunction);
}

export function compileStrings(namespace : Optional<string>, id : string, env : Env) {
    compile(namespace, id, env, makeStrFunction);
}

function compile(namespace : Optional<string>, id : string, env : Env, compiler : Compiler) {
    const obj = getObj(namespace, id, env);
    const scope = getScope(namespace, obj, env);
    compileObj(obj, scope, compiler);
}


function getObj(namespace : Optional<string>, id : string, env : Env) {
    const path = Path.fromValueList((namespace == undefined)? [id] : [namespace, id]);
    return env.get(path);
}

function getScope(namespace : Optional<string>, obj : Obj, env : Env) : Env {
    const nsEnv = (namespace != undefined)? env.newChild(env.createNamespaceReferences([namespace])) : env; 
    return nsEnv.newChild({"this" : obj}).newChild(obj);
}

function compileObj(obj : Obj, scope : Env, compiler : Compiler, isInnerObject = false) : void {
    Object.entries(obj)
          .forEach(([name, value]) => {
            if (isInnerObject || !SPECIAL_FIELDS.includes(name)) {
                const fnImpl = compiler(name, value, scope, obj);
                if (fnImpl) {
                    obj[fnImpl.name] = fnImpl.envFn;
                } else if (_.isObject(value)) {
                    compileObj(value, scope.newChild(obj), compiler, true );
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
const compileFunction : Compiler = (name, value, scope, _obj) => {
    const fnDef = getFunctionDef(name);
    let result : Optional<FnImpl> = undefined;
    if (fnDef) {
        let envFn : EnvFn;
        if (_.isFunction(value)) {
            // Could be implicitly defined function (no compilation needed)
            envFn = value;
        } else {
            // Else compile the function
            const thunk = RuleBuilder.evaluateRule(value);
            envFn = (env) => thunk.resolve(env);
        }
        result = {
            name : fnDef.name, 
            envFn : bindParams(fnDef.params, envFn, scope)
        };
    }
    return result;
}

function getFunctionDef(str : string) : Optional<FnDef> {
    const match = FN_REGEX.exec(str);
    let result = undefined;
    if (match) {
        const name = match[1];
        const params = match[2].split(",").map(param => param.trim());
        result = {name, params};
    }
    return result;
}