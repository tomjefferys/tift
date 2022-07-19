import jsep, {Expression, CallExpression, Identifier, Literal, BinaryExpression, MemberExpression, ArrayExpression} from 'jsep';

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

interface Thunk {
    resolve : EnvFn,
    expression : Expression,
    isBuiltIn : boolean
}

function mkThunk(expression : Expression, envFn : EnvFn, isBuiltIn = false) : Thunk {
    return {
        resolve : envFn,
        expression : expression,
        isBuiltIn : isBuiltIn
    }
}

const BUILTINS : {[key:string]:EnvFn} = {
    "if" : makeIf(),
    "do" : makeDo(),
    "set" : makeSet(),
    "def" : makeDef()
}

export const ARGS = "__args__"; 

export function parse(expression : string) : (env : Env) => any {
    const parseTree = jsep(expression);
    return env => evaluate(parseTree).resolve(env).value;
}

function evaluate(expression : Expression) : Thunk {
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
        case "ArrayExpression":
            return evaluateArrayExpression(expression as ArrayExpression);

    }
    throw new Error("Unknown expression type: " + expression.type);
}

/**
 * Convert a callExpression into a javascript function
 * @param callExpression 
 * @returns 
 */
function evaluateCallExpression(callExpression : CallExpression) : Thunk {
    const builtIns = ["if", "set", "def", "do"];
    const argThunks = callExpression.arguments.map(e => evaluate(e));
    const callee = callExpression.callee;
    let result : Thunk;
    if (callee.type === "Identifier" && builtIns.includes((callee as Identifier).name)) {
        result = evaluateBuiltIn(callee as Identifier, callExpression.arguments);
    } else if (callee.type === "MemberExpression") {
        result = evaluateMemberCallExpression(callee as MemberExpression, argThunks);
    } else {
        result = evaluateFunctionCall(callee, argThunks);
}
    return result;
}

// TODO should pass in the whole call expression
function evaluateBuiltIn(callee : Identifier, args : Expression[]) : Thunk {
    const builtIn = BUILTINS[callee.name];
    if (!builtIn) {
        throw new Error("Unknown built in function");
    }

    let argThunks : Thunk[];
    // FIXME, this is ugly, don't special case set like this.
    // FIXME rename evaluateMemberProperty, it's now overloaded, and is not evaluating a member property here
    if (callee.name === "set" || callee.name === "def") {
        argThunks = [evalutateMemberProperty(args[0]), evaluate(args[1])];
    } else {
        argThunks = args.map(arg => evaluate(arg));
    }

    const envFn : EnvFn = env => builtIn(env.newChild({[ARGS] : argThunks.map(thunk => thunk.resolve)}));
    return mkThunk(callee, envFn, true);
}

/**
 * Evaluate a member call expression.
 * We need to check if this is a built in expression, so we can pass through the 
 * arguments as thunks rather than values
 * @param callee 
 * @param argThunks 
 * @returns 
 */
function evaluateMemberCallExpression(callee : MemberExpression, argThunks : Thunk[]) : Thunk {
    const keywordProperties = ["then", "else", "case"];
    let thunk : Thunk;
    if (callee.property.type === "Identifier" && keywordProperties.includes((callee.property as Identifier).name)) {
        const objThunk = evaluate(callee.object);
        const propName = (callee.property as Identifier).name;
        const envFn : EnvFn = env => {
            const obj = objThunk.resolve(env);
            const fn = obj[propName];
            const result = fn(env.newChild({[ARGS]: argThunks}));
            return mkResult(result);
        }
        thunk = mkThunk(callee, envFn, true);
    } else {
        thunk = evaluateFunctionCall(callee, argThunks);
    }
    return thunk;

}


/**
 * Evaluate a traditional function call, argunement thunks are evaluated, and their values 
 * passed to the function
 * @param call 
 * @param argThunks  
 * @returns 
 */
function evaluateFunctionCall(callee : Expression, argThunks : Thunk[]) : Thunk {
    const calleeThunk = evaluate(callee);
    const envFn : EnvFn = env => {
        const callee = calleeThunk.resolve(env).getValue();
        const argValues = argThunks.map(arg => arg.resolve(env).getValue());
        const result = callee(env.newChild({[ARGS]: argValues}));
        return mkResult(result);
    }
    return mkThunk(callee, envFn)
}

/**
 * Convert a member expression into a javascript function
 * @param memberExpression 
 * @returns 
 */
function evaluateMemberExpression(memberExpression : MemberExpression) : Thunk {
    const objThunk = evaluate(memberExpression.object);
    const propertyThunk = evalutateMemberProperty(memberExpression.property);
    const envFn : EnvFn = env => {
        let obj = objThunk.resolve(env);  // Don't need getValue, obj expressions should directly return an object
        const property = propertyThunk.resolve(env).getValue();
        if (typeof property === "number") { // If this is a number then it's an array, get the value
            obj = obj.getValue();
        }
        return mkResult(obj[property]);
    }
    return mkThunk(memberExpression, envFn);
}

/**
 * Evaluate a member property.  Identifiers need to be handled a little differently from usual 
 *   to ensure we don't try to look them up in the environment
 */
function evalutateMemberProperty(expression : Expression) : Thunk {
    switch(expression.type) {
        case "Identifier":
            return mkThunk(expression, _ => mkResult((expression as Identifier).name));
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
function evaluateIdentifier(identifier : Identifier) : Thunk {
    const envFn : EnvFn =  env => mkResult(env.get(identifier.name));
    return mkThunk(identifier, envFn);
}


function evaluateBinaryExpression(expression : BinaryExpression)  : Thunk {
    const leftThunk = evaluate(expression.left);
    const rightThunk = evaluate(expression.right);
    const fn = BINARY_FUNCTIONS[expression.operator];
    if (!fn) {
        throw new Error("Unknown operatior: " + expression.operator);
    }
    const envFn : EnvFn = env => {
        const left = leftThunk.resolve(env).getValue();
        const right = rightThunk.resolve(env).getValue();
        return mkResult(fn(left, right));
    }
    return mkThunk(expression, envFn);
}

function evaluateArrayExpression(expression : ArrayExpression) : Thunk {
    const elementThunks = expression.elements.map(e => evaluate(e));
    const envFn : EnvFn = env => mkResult(elementThunks.map(thunk => thunk.resolve(env).getValue()));
    return mkThunk(expression, envFn);
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

function evaluateLiteral(literal : Literal) : Thunk {
    const envFn : EnvFn =  _ => mkResult(literal.value);
    return mkThunk(literal, envFn);
}

export function bindParams(params : string[], fn : EnvFn) : EnvFn {
    return env => {
        const args = env.get(ARGS);
        for(let i=0; i<args.length && i<params.length; i++) {
            env.def(params[i], args[i]);
        }
        return fn(env);
    }
}

function makeDef() : EnvFn {
    const defFn = (env : Env) => {
        if (!env.parent) {
            throw new Error("Can't set: no parent environment");
        }
        const name = env.get("name")(env).getValue();
        const value = env.get("value")(env).getValue();
        env.parent.def(name, value);
        return mkResult(value);
    }
    return bindParams(["name", "value"], defFn);
}

/**
 * Creates a set function
 * @returns 
 */
function makeSet() : EnvFn {
    const setFn = (env : Env) => {
        if (!env.parent) {
            throw new Error("Can't set: no parent environment");
        }
        const name = env.get("name")(env).getValue();
        const value = env.get("value")(env).getValue();
        env.parent.set(name, value);
        return mkResult(value);
    }
    return bindParams(["name", "value"], setFn);
}

/**
 * Makes a compound expression eg do(set(a, 123), write(a))
 */
function makeDo() : EnvFn {
    return env => {
        const args = env.get(ARGS);
        let retVal = undefined;
        for(const arg of args) {
            retVal = arg(env).getValue();
        }
        return mkResult(retVal);
    }
}

/**
 * Creates an if function.  On Execution, this creates a Result object with extra `then` and `else` methods attached,
 * which can then be executed using member evaluation
 * 
 * eg if(3 > 4).then("foo").else("bar")
 */
function makeIf() : EnvFn {
    type ThenElse = {"then" : EnvFn, "else" : EnvFn}

    // Create the then/else methods.  exprResult is the reusult of the boolen expression, value is 
    // the current value to be returned.  The value is passed in via the then/else methods
    const mkThenElse = (exprResult : any, value : any) : ThenElse => {
        return {
            "then" : bindParams(["thenExpr"], (env : Env) => {
                const newValue = (exprResult)? env.get("thenExpr").resolve(env).getValue() : value; 
                return mkResult(newValue, mkThenElse(exprResult, newValue));
            }),
            "else" : bindParams(["elseExpr"], (env : Env) => {
                const newValue = (!exprResult)? env.get("elseExpr").resolve(env).getValue() : value;
                return mkResult(newValue, mkThenElse(exprResult, newValue));
            })
        }
    }

    const ifFn : EnvFn = env => {
        const exprResult = env.get("expr")(env).getValue();
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
