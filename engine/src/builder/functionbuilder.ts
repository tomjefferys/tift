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

const FN_REGEX = /^(\w+)\(([\w, ]*)\)$/;

type FnDef = {
    name : string, 
    params : string[]
}

export function compileFunctions(namespace : Optional<string>, id : string, env : Env) {
    const obj = getObj(namespace, id, env);
    const scope = getScope(namespace, obj, env);
    compileObjFunctions(obj, scope);
}

export function compileStrings(namespace : Optional<string>, id : string, env : Env) {
    const obj = getObj(namespace, id, env);
    const scope = getScope(namespace, obj, env);
    compileObjStrings(obj, scope);
}

function getObj(namespace : Optional<string>, id : string, env : Env) {
    const path = Path.fromValueList((namespace == undefined)? [id] : [namespace, id]);
    return env.get(path);
}

function getScope(namespace : Optional<string>, obj : Obj, env : Env) : Env {
    const nsEnv = (namespace != undefined)? env.newChild(env.createNamespaceReferences([namespace])) : env; 
    return nsEnv.newChild({"this" : obj}).newChild(obj);
}

// 'compiles' any strings containing a mustache expression 
// to a function, so it can be evalutated at run time
function compileObjStrings(obj : Obj, scope : Env) : void {
    Object.entries(obj)
          .filter(([_name, value]) => {
            return _.isString(value) && value.includes("{{")
          })
          .filter(([name, _value]) => name !== "desc")
          .forEach(([name, value]) => {
            const strFn = Object.assign(
             (_env : Env) => mkResult(formatString(scope, value)),
             {[IMPLICIT_FUNCTION] : true} // Define "implicit" as a constant.  Maybe call it "__IMPLICIT_FUNCTION__"
            );
            obj[name] = strFn;
          });
}

/**
 * functions can be defined as 
 * myFunc(): print("hello world")
 * add(var1, var2): var1 + var2
 * @param obj 
 */
function compileObjFunctions(obj : Obj, scope : Env) : Obj {
    Object.entries(obj).map(
        ([name, value]) => {
            const fnDef = getFunctionDef(name);
            if (fnDef) {
                // If value is a string compile it, else assume it's an envFunction
                let envFn : EnvFn;
                if (_.isFunction(value)) {
                    envFn = value;
                } else {
                    const thunk = RuleBuilder.evaluateRule(value);
                    envFn = (env : Env) => thunk.resolve(env);
                }
                obj[fnDef.name] = bindParams(fnDef.params, envFn, scope);
            }
        }
    );
    return obj;
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