import { Env } from "../env"
import { Expression } from "jsep";
import * as _ from "lodash";

export interface Result {
    value : unknown,
    getValue : () => unknown;
    [others : string] : unknown
}

export type EnvFn = (env : Env) => Result;

/**
 * Builtin functions need to be handled a bit differently from normal ones
 * so, we save a thunk type with the thunk
 */
export type ThunkType = "normal" | "builtin" | "property"

/**
 * A Thunk; an unresolved expression, compiled by the parser but 
 * not executed.
 */
export interface Thunk {
    resolve : EnvFn,
    expression? : Expression,
    type : ThunkType
}


export function mkThunk(envFn : EnvFn, expression? : Expression, type : ThunkType = "normal") : Thunk {
    return {
        resolve : envFn,
        expression : expression,
        type : type
    }
}

/**
 * Wraps the result of an evaluation in an object
 * Results can be wrapped in other results, use the `getValue` method to find the most deeply nested value
 * @param result 
 * @returns 
 */
 export function mkResult(result : unknown, properties = {}) : Result {
    const isAlreadyResult = result && _.has(result,"value");
    if (isAlreadyResult) { 
        return result as Result;
    }
    const resultObj = { 
        value : result,
        getValue : () => {
            return resultObj.value;
        }
    };
    return {...resultObj, ...properties};
}