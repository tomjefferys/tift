import { Env } from "../env"
import { Expression } from "jsep";

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
    expression : Expression,
    type : ThunkType
}


export function mkThunk(expression : Expression, envFn : EnvFn, type : ThunkType = "normal") : Thunk {
    return {
        resolve : envFn,
        expression : expression,
        type : type
    }
}