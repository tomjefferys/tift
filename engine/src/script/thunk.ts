import { Env } from "tift-types/src/env"
import { Expression } from "jsep";
import { exprToString } from "./expressionutils";
import { rethrowExecutionError } from "../util/errors";

export interface Result {
    value : unknown,
    getValue : () => unknown;
    [others : string] : unknown
}

export type EnvFn = (env : Env) => Result;

/**
 * "property" identifiers are keyword member names (then/else/case/default, see KEYWORD_PROPS in
 * parser.ts) that resolve to their own literal name rather than being looked up in the env -
 * distinct from whether the eventual callee is a "lazy" function (see markLazy in parser.ts),
 * which is a property of the resolved function value, not of the identifier/thunk itself.
 */
export type ThunkType = "normal" | "property"

/**
 * A Thunk; an unresolved expression, compiled by the parser but 
 * not executed.
 */
export interface Thunk {
    resolve : EnvFn,
    expression? : Expression,
    type : ThunkType,
    toString : () => string
}

export function mkThunk(envFn : EnvFn, expression? : Expression, type : ThunkType = "normal") : Thunk {
    const errorHandledFn : EnvFn = env => {
        try {
            return envFn(env);
        } catch(e) {
            if (expression) {
                rethrowExecutionError(exprToString(expression), e);
            } else {
                throw e;
            }
        }
    }
    return {
        resolve : errorHandledFn,
        expression, type,
        toString : () => exprToString(expression)
    }
}

/**
 * Wraps the result of an evaluation in an object
 * Results can be wrapped in other results, use the `getValue` method to find the most deeply nested value
 * @param result 
 * @returns 
 */
function isResult(value: unknown): value is Result {
    return value != null && typeof value === 'object' && 'value' in value && 'getValue' in value;
}

 export function mkResult(result : unknown, properties = {}) : Result {
    if (isResult(result)) { 
        return result;
    }
    const resultObj = { 
        value : result,
        getValue : () => {
            return resultObj.value;
        }
    };
    return {...resultObj, ...properties};
}