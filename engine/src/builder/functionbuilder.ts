import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";
import { Optional } from "tift-types/src/util/optional";
import { bindParams } from "../script/parser";
import * as Path from "../path";
import * as RuleBuilder from "./rulebuilder";

const FN_REGEX = /^(\w+)\(([\w, ]*)\)$/;

type FnDef = {
    name : string, 
    params : string[]
}

export function compileFunctions(namespace : Optional<string>, id : string, env : Env) {
    const path = Path.fromValueList((namespace == undefined)? [id] : [namespace, id]);
    const obj = env.get(path);
    // Set up the scope
    // TODO we're doing something similar in phaseaction and mustacheUtils. Consider a "scopeutils" 
    const nsEnv = (namespace != undefined)? env.newChild(env.createNamespaceReferences([namespace])) : env; 
    const scope = nsEnv.newChild({"this" : obj})
                       .newChild(obj);
    compileObjFunctions(obj, scope);
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
                const thunk = RuleBuilder.evaluateRule(value);
                obj[fnDef.name] = bindParams(fnDef.params, (env : Env) => thunk.resolve(env), scope);
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