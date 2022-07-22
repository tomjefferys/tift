import jsep, {Expression, CallExpression, Identifier, Literal, BinaryExpression, MemberExpression, ArrayExpression} from 'jsep';
import { indexOf } from 'lodash';
import { keywords } from 'moo';

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


type ThunkType = "normal" | "builtin" | "property"

interface Thunk {
    resolve : EnvFn,
    expression : Expression,
    type : ThunkType
}


function mkThunk(expression : Expression, envFn : EnvFn, type : ThunkType = "normal") : Thunk {
    return {
        resolve : envFn,
        expression : expression,
        type : type
    }
}

const BUILTINS : {[key:string]:EnvFn} = {
    "if" : makeIf(),
    "do" : makeDo(),
    "set" : makeSet(),
    "def" : makeDef()
}

const KEYWORD_PROPS = ["then", "else", "case"];

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
 * Evaluate a traditional function call, argunement thunks are evaluated, and their values 
 * passed to the function
 * @param call 
 * @param argThunks  
 * @returns 
 */
function evaluateCallExpression(callExpression : CallExpression) : Thunk {
    const calleeThunk = evaluate(callExpression.callee);
    const envFn : EnvFn = env => {
        const callee = calleeThunk.resolve(env);
        const args = callExpression.arguments;
        let result : Result;
        if (calleeThunk.type === "builtin") {
            const calleeName = (callExpression.callee as Identifier).name;
            const argThunks = evaluateBuiltInArgs(calleeName, args);
            result = callee.getValue()(env.newChild({[ARGS] : argThunks.map(thunk => thunk.resolve)}));
        } else {
            const argThunks = args.map(e => evaluate(e))
            const resolvedArgs = (calleeThunk.type === "property")? argThunks : resolveThunks(argThunks, env);
            const fn = callee.getValue();
            const fnResult = fn(env.newChild({[ARGS] : resolvedArgs}));
            result = mkResult(fnResult);
        }
        return result;
    }
    return mkThunk(callExpression, envFn)
}

function evaluateBuiltInArgs(calleeName : string, args : Expression[]) {
    let argThunks : Thunk[];
    if (calleeName === "set" || calleeName === "def") {
        argThunks = [evalutateName(args[0]), evaluate(args[1])];
    } else {
        argThunks = args.map(arg => evaluate(arg));
    }
    return argThunks;
}

function resolveThunks(thunks : Thunk[], env : Env) : any[] {
    return thunks.map(thunk => thunk.resolve(env).getValue());
}

/**
 * Convert a member expression into a javascript function
 * @param memberExpression 
 * @returns 
 */
function evaluateMemberExpression(memberExpression : MemberExpression) : Thunk {
    const objThunk = evaluate(memberExpression.object);
    const builtInProperty = getBuiltInProperty(memberExpression.property);
    
    let envFn : EnvFn;
    if (builtInProperty) {
        envFn = env => {
            const obj = objThunk.resolve(env);
            return mkResult(obj[builtInProperty]);
        }
    } else {
        const propertyThunk = evalutateName(memberExpression.property);
        envFn = env => {
            const obj = objThunk.resolve(env).getValue();
            const property = propertyThunk.resolve(env).getValue();
            return mkResult(obj[property]);
        }
    }
    return mkThunk(memberExpression, envFn, builtInProperty? "property" : "normal");
}

function getBuiltInProperty(expression : Expression) : string | undefined {
    let result = undefined;
    if (expression.type === "Identifier" && KEYWORD_PROPS.includes((expression as Identifier).name)) {
       const name = (expression as Identifier).name; 
       if (KEYWORD_PROPS.includes(name)) {
            result = name;
       }
    }
    return result;
}

/**
 * Evaluate a "name", this could be a literal type, or an identifier
 * If it's an identifier don't look up the identifier in the environment, 
 * return instead the identifiers "name"  (ie the literal strig value of the identifier)
 */
function evalutateName(expression : Expression) : Thunk {
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
    const type : ThunkType = getIdentifierType(identifier);
    const isBuiltin = BUILTINS.hasOwnProperty(identifier.name);
    const builtIn = BUILTINS[identifier.name];
    let envFn : EnvFn;
    switch(type) {
        case("builtin"):
            envFn = _ => mkResult(builtIn);
            break;
        case("property"):
            envFn = _ => mkResult(identifier.name);
            break;
        case("normal"):
            envFn = env => mkResult(env.get(identifier.name));
            break;
    }
    return mkThunk(identifier, envFn, type);
}

function getIdentifierType(identifier : Identifier) : ThunkType {
    if (BUILTINS.hasOwnProperty(identifier.name)) {
        return "builtin";
    } else if (KEYWORD_PROPS.includes(identifier.name)) {
        return "property";
    } else {
        return "normal";
    }
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
