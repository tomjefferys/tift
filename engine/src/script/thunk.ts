import { Env } from "../env"
import { ArrayExpression, BinaryExpression, CallExpression, Expression, Identifier, Literal, MemberExpression, UnaryExpression } from "jsep";
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
    type : ThunkType,
    toString : () => string
}

export function mkThunk(envFn : EnvFn, expression? : Expression, type : ThunkType = "normal") : Thunk {
    return {
        resolve : envFn,
        expression : expression,
        type : type,
        toString : () => exprToString(expression)
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

function exprToString(expr? : Expression) : string {
    if (!expr) {
        return "";
    }
    let str = "";
    switch(expr.type) {
        case "Identitifer":
            str = (expr as Identifier).name;
            break;
        case "Literal":
            str = (expr as Literal).raw;
            break;
        case "ThisExpression":
            str = "this";
            break;
        case "UnaryExpression": {
                const unary = expr as UnaryExpression;
                str = unary.operator + exprToString(unary.argument);
            }
            break;
        case "BinaryExpression": {
                const binary = expr as BinaryExpression;
                str = exprToString(binary.left) + binary.operator + exprToString(binary.right);
            }
            break;
        case "ArrayExpression":
            str = "[" + (expr as ArrayExpression).elements.map(element => exprToString(element)).join(", ") + "]";
            break;
        case "CallExpression": {
                const call = expr as CallExpression;
                str = exprToString(call.callee) + 
                        "(" + call.arguments.map(arg => exprToString(arg)).join(",") + ")";
            }
            break;
        case "MemberExpression": {
                const memberExpr = expr as MemberExpression;
                str = exprToString(memberExpr.object) + "." + exprToString(memberExpr.property);
            }
            break;
        default: 
            str = "unknown expression type " + expr.type;
    }
    return str;
}