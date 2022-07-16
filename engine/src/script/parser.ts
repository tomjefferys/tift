import jsep, {Expression, CallExpression, Identifier, Literal, BinaryExpression, MemberExpression} from 'jsep';

import { Env } from '../env'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Result {
    value : any,
    getValue : () => any;
    [others : string] : any
}

type BinaryFunction = (l : any, r : any) => any;

const BINARY_FUNCTIONS : {[key:string]:BinaryFunction} = {
    "+": (l,r) => l + r,
    "-": (l,r) => l - r,
    "*": (l,r) => l * r,
    "/": (l,r) => l / r,
    "%": (l,r) => l % r,
    "==": (l,r) => l === r,
    "!=": (l,r) => l !== r,
    ">": (l,r) => l > r,
    "<": (l,r) => l < r,
    ">=": (l,r) => l >= r,
    "<=": (l,r) => l <= r,
    "||": (l,r) => l || r,
    "&&": (l,r) => l && r,
    "|": (l,r) => l | r,
    "&": (l,r) => l & r,
    "^": (l,r) => l ^ r
}

export type EnvFn = (env : Env) => Result;

export function parse(expression : string) : (env : Env) => any {
    const parseTree = jsep(expression);
    return env => evaluate(parseTree)(env).value;
}

function evaluate(expression : Expression)  : EnvFn {
    switch(expression.type) {
        case "CallExpression": 
            return evaluateCallExpression(expression as CallExpression);
        case "MemberExpression":
            return evaluateMemberExpression(expression as MemberExpression);
        case "Identifier": 
            return evaluateIdentifier(expression as Identifier);
        case "Literal":
            return evaluateLiteral(expression as Literal);
        case "BinaryExpression":
            return evaluateBinaryExpression(expression as BinaryExpression);

    }
    throw new Error("Unknown expression type: " + expression.type);
}

/**
 * Convert a callExpression into a javascript function
 * @param callExpression 
 * @returns 
 */
function evaluateCallExpression(callExpression : CallExpression) : EnvFn {
    const calleeThunk = evaluate(callExpression.callee);
    const argThunks = callExpression.arguments.map(e => evaluate(e));
    return env => {
        const callee = calleeThunk(env).getValue();
        const argValues = argThunks.map(arg => arg(env).getValue());
        const result = callee(env.newChild({"__args__" : argValues})); // FIXME, maybe pass through unevaluated arguments
        return mkResult(result);
    }
}

/**
 * Convert a member expression into a javascript function
 * @param memberExpression 
 * @returns 
 */
function evaluateMemberExpression(memberExpression : MemberExpression) : EnvFn {
    const objThunk = evaluate(memberExpression.object);
    const propertyThunk = evalutateMemberProperty(memberExpression.property);
    return env => {
        const obj = objThunk(env);  // Don't need getValue, obj expressions should directly return an object
        const property = propertyThunk(env).getValue();
        return mkResult(obj[property]);
    }
}

/**
 * Evaluate a member property.  Identifiers need to be handled a little differently from usual 
 *   to ensure we don't try to look them up in the environment
 */
function evalutateMemberProperty(expression : Expression) : EnvFn {
    switch(expression.type) {
        case "Identifier":
            return _ => mkResult((expression as Identifier).name);
        case "Literal":
            return evaluateLiteral(expression as Literal);
        default:
            throw new Error("Unknown member property expression: " + expression.type);
    }
}


/**
 * Convert an Identifier into a javascript function
 * @param identifier 
 * @returns 
 */
function evaluateIdentifier(identifier : Identifier) : EnvFn {
    return env => mkResult(env.get(identifier.name));
}


function evaluateBinaryExpression(expression : BinaryExpression)  : EnvFn {
    const leftThunk = evaluate(expression.left);
    const rightThunk = evaluate(expression.right);
    const fn = BINARY_FUNCTIONS[expression.operator];
    if (!fn) {
        throw new Error("Unknown operatior: " + expression.operator);
    }
    return env => {
        const left = leftThunk(env).getValue();
        const right = rightThunk(env).getValue();
        return mkResult(fn(left, right));
    }
}

/**
 * Wraps the result of an evaluation in an object
 * Results can be wrapped in other results, use the `getValue` method to find the most deeply nested value
 * @param result 
 * @returns 
 */
function mkResult(result : any, properties = {}) : Result {
    const isAlreadyResult = result && result.hasOwnProperty("value");
    if (isAlreadyResult) { 
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

function evaluateLiteral(literal : Literal) : (env : Env) => any {
    return _ => mkResult(literal.value);
}

export function bindParams(params : string[], fn : EnvFn) : EnvFn {
    return env => {
        const namedArgs : {[key:string]:any}= {};
        const args = env.get("__args__");
        for(let i=0; i<args.length && i<params.length; i++) {
            namedArgs[params[i]] = args[i];
        }
        return fn(env.newChild(namedArgs));
    }
}

/**
 * Creates an if function.  On Execution, this creates a Result object with extra `then` and `else` methods attached,
 * which can then be executed using member evaluation
 * 
 * eg if(3 > 4).then("foo").else("bar")
 */
export function makeIf() : EnvFn {
    type ThenElse = {"then" : EnvFn, "else" : EnvFn}

    // Create the then/else methods.  exprResult is the reusult of the boolen expression, value is 
    // the current value to be returned.  The value is passed in via the then/else methods
    const mkThenElse = (exprResult : any, value : any) : ThenElse => {
        return {
            "then" : bindParams(["thenExpr"], (env : Env) => {
                const newValue = (exprResult)? env.get("thenExpr") : value; 
                return mkResult(newValue, mkThenElse(exprResult, newValue));
            }),
            "else" : bindParams(["elseExpr"], (env : Env) => {
                const newValue = (!exprResult)? env.get("elseExpr") : value;
                return mkResult(newValue, mkThenElse(exprResult, newValue));
            })
        }
    }

    const ifFn : EnvFn = env => {
        const exprResult = env.get("expr");
        const thenElse = mkThenElse(exprResult, undefined);
        return mkResult(exprResult, thenElse);
    }

    return bindParams(["expr"], ifFn);
}

/**
 * Switch statement
 * switch(expr)
 *  .case(1, "foo")
 *  .case(2, "bar")
 *  .case(3, "baz")
 *  .default("qux")
 * 
 * or could we do:
 * switch(expr)
 *  .case(1).then("foo")
 *  .case(2).then("bar")
 *  .case(3).then("baz")
 *  .default("qux")
 */
//export function makeSwitch() : EnvFn {
//    type Case = {"case" : EnvFn };
//    type Then = {"then" : EnvFn };
//
//    const mkCase = (expr)
//}

/* eslint-enable @typescript-eslint/no-explicit-any */
