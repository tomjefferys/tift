import jsep, {Expression, CallExpression, Identifier, Literal, BinaryExpression, MemberExpression, ArrayExpression, IPlugin, UnaryExpression, ThisExpression, Compound} from 'jsep';
import { Result, EnvFn, Thunk, ThunkType, mkThunk, mkResult } from "./thunk"

import { Env } from 'tift-types/src/env'
import * as _ from 'lodash'
import { parsePathExpr } from './pathparser';
import { isPath } from '../path';
import  jsepAssignment, { AssignmentExpression } from '@jsep-plugin/assignment';
import { Optional } from 'tift-types/src/util/optional';
import { rethrowCompileError } from '../util/errors';
import { formatString } from '../util/mustacheUtils';

// Configure Jsep
jsep.plugins.register(jsepAssignment as unknown as IPlugin);
jsep.addBinaryOp("=>", 0);

/* eslint-disable @typescript-eslint/no-explicit-any */
type BinaryFunction = (l : any, r : any) => any;
type UnaryFunction = (n : any) => any;

/* eslint-enable @typescript-eslint/no-explicit-any */

const UNARY_FUNCTIONS : {[key:string]:UnaryFunction} = {
    "+" : n => +n,
    "-" : n => -n,
    "!" : n => !n,
    "~" : n => ~n
}

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

const ASSIGNMENT_FUNCTIONS : {[key:string]:BinaryFunction} = {
    "*=" : (l,r) => l * r,
    "**=" : (l,r) => l ** r,
    "/=" : (l,r) => l / r,
    "%=" : (l,r) => l & r,
    "+=" : (l,r) => l + r,
    "-=" : (l,r) => l - r,
    "<<=" : (l,r) => l << r,
    ">>=" : (l,r) => l >> r,
    ">>>=" : (l,r) => l >>> r,
    "&=" : (l,r) => l & r,
    "^=" : (l,r) => l ^ r,
    "|=" : (l,r) => l | r
}

const BUILTINS : {[key:string]:EnvFn} = {
    "if" : makeIf(),
    "do" : makeDo(),
    "set" : makeSet(),
    "def" : makeDef(),
    "switch" : makeSwitch(),
    "fn" : makeFn()
}

const KEYWORD_PROPS = ["then", "else", "case", "default"];

export const ARGS = "__args__"; 

export function parseToTree(expression : string, objPath? : string) {
    try {
        return jsep(expression);
    } catch (e) {
        rethrowCompileError(expression, e, objPath);
    }
}

export function parseToThunk(expression : string, objPath? : string) : Thunk {
    const parseTree = parseToTree(expression, objPath);
    return evaluate(parseTree);
}

export function parse(expression : string, objPath? : string) : (env : Env) => unknown {
    const compiledExpression = parseToThunk(expression, objPath);
    return env => compiledExpression.resolve(env).value;
}

export function evaluate(expression : Expression) : Thunk {
    switch(expression.type) {
        case "CallExpression": 
            return evaluateCallExpression(expression as CallExpression);
        case "MemberExpression":
            return evaluateMemberExpression(expression as MemberExpression);
        case "Identifier": 
            return evaluateIdentifier(expression as Identifier);
        case "Literal":
            return evaluateLiteral(expression as Literal);
        case "UnaryExpression":
            return evaluateUnaryExpressoin(expression as UnaryExpression);
        case "BinaryExpression":
            return evaluateBinaryExpression(expression as BinaryExpression);
        case "ArrayExpression":
            return evaluateArrayExpression(expression as ArrayExpression);
        case "ThisExpression":
            return evaluateThis(expression as ThisExpression);
        case "Compound":
            return evaluateCompound(expression as Compound);
        case "AssignmentExpression":
            return evaluateAssignmentExpression(expression as AssignmentExpression);

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
            const fn = callee.getValue() as EnvFn;
            result = fn(env.newChild({[ARGS] : argThunks.map(thunk => thunk.resolve)}));
        } else {
            const argThunks = args.map(e => evaluate(e))
            const resolvedArgs = (calleeThunk.type === "property")? argThunks : resolveThunks(argThunks, env);
            const fn = callee.getValue() as EnvFn;
            const fnResult = fn(env.newChild({[ARGS] : resolvedArgs}));
            result = mkResult(fnResult);
        }
        return result;
    }
    return mkThunk(envFn, callExpression)
}

function evaluateBuiltInArgs(calleeName : string, args : Expression[]) {
    let argThunks : Thunk[];
    if (calleeName === "set" || calleeName === "def") {
        argThunks = [evaluateName(args[0]), evaluate(args[1])];
    } else if (calleeName === "fn") {
        const parameters = args[0];
        if (parameters.type === "ArrayExpression") {
            argThunks = [evaluateNameArray(parameters as ArrayExpression), evaluate(args[1])]
        } else {
            throw new Error("First parameter of function definition should be an array of parameters");
        }
    } else {
        argThunks = args.map(arg => evaluate(arg));
    }
    return argThunks;
}

function resolveThunks(thunks : Thunk[], env : Env) : unknown[] {
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
        const propertyThunk = evaluateName(memberExpression.property);
        envFn = env => {
            const obj = objThunk.resolve(env).getValue() as {[key:string]:unknown}
            const property = propertyThunk.resolve(env).getValue() as string;
            return mkResult(obj[property]);
        }
    }
    return mkThunk(envFn, memberExpression, builtInProperty? "property" : "normal");
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
function evaluateName(expression : Expression) : Thunk {
    return mkThunk(_ => mkResult(parsePathExpr(expression), expression));
}

function evaluateNameArray(expression : ArrayExpression) : Thunk {
    const envFn : EnvFn = _ => mkResult(expression.elements.map(element => parsePathExpr(element)));
    return mkThunk(envFn, expression);
}

/**
 * Convert an Identifier into a javascript function
 * @param identifier 
 * @returns 
 */
function evaluateIdentifier(identifier : Identifier) : Thunk {
    const type : ThunkType = getIdentifierType(identifier);
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
    return mkThunk(envFn, identifier, type);
}

function getIdentifierType(identifier : Identifier) : ThunkType {
    if (_.has(BUILTINS,identifier.name)) {
        return "builtin";
    } else if (KEYWORD_PROPS.includes(identifier.name)) {
        return "property";
    } else {
        return "normal";
    }
}

function evaluateUnaryExpressoin(expression : UnaryExpression) : Thunk {
    const argThunk = evaluate(expression.argument);
    const fn = UNARY_FUNCTIONS[expression.operator];
    if (!fn) {
        throw new Error("Unknown operator: " + expression.operator);
    }
    const envFn : EnvFn = env => {
        const arg = argThunk.resolve(env).getValue();
        return mkResult(fn(arg));
    }
    return mkThunk(envFn, expression);
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
    return mkThunk(envFn, expression);
}

function evaluateArrayExpression(expression : ArrayExpression) : Thunk {
    const elementThunks = expression.elements.map(e => evaluate(e));
    const envFn : EnvFn = env => mkResult(elementThunks.map(thunk => thunk.resolve(env).getValue()));
    return mkThunk(envFn, expression);
}

function evaluateThis(_this : ThisExpression) : Thunk {
    return mkThunk(env => mkResult(env.get("this")));
}

function evaluateLiteral(literal : Literal) : Thunk {
    const envFn : EnvFn =  _.isString(literal.value)? mkStringFn(literal.value) : _ => mkResult(literal.value);
    return mkThunk(envFn, literal);
}

function mkStringFn(str : string) : EnvFn {
    return env => mkResult(formatString(env, str));
}

function evaluateCompound(compound : Compound) {
    const envFn : EnvFn = env => {
        const bodyThunks = compound.body.map(e => evaluate(e));
        const resolved = resolveThunks(bodyThunks, env);
        return mkResult(_.last(resolved));
    }
    return mkThunk(envFn, compound);
}

function evaluateAssignmentExpression(assignment : AssignmentExpression) : Thunk {
    if (assignment.operator === "=") {
        const leftExpr = evaluateName(assignment.left);
        const rightExpr = evaluate(assignment.right);
        return mkThunk(env => set(env, leftExpr.resolve, rightExpr.resolve), assignment);

    } else if (_.has(ASSIGNMENT_FUNCTIONS, assignment.operator)) {
        const assignmentFn = ASSIGNMENT_FUNCTIONS[assignment.operator];
        const nameExpr = evaluateName(assignment.left);
        const leftExpr = evaluate(assignment.left);
        const rightExpr = evaluate(assignment.right);
        const valueFn : EnvFn = env => {
            const left = leftExpr.resolve(env).getValue();
            const right = rightExpr.resolve(env).getValue();
            return mkResult(assignmentFn(left, right));
        }
        return mkThunk(env => set(env, nameExpr.resolve, valueFn));
    } else {
        throw new Error("Unsupported assignment operator: " + assignment.operator);
    }
}

export function bindParams(params : string[], fn : EnvFn, closureEnv : Optional<Env> = undefined) : EnvFn {
    return env => {
        const args = env.get(ARGS);
        const scope = closureEnv?.newChild() ?? env
        for(let i=0; i<args.length && i<params.length; i++) {
            scope.def(params[i], args[i]);
        }
        return fn(scope);
    }
}

function makeDef() : EnvFn {
    const defFn = (env : Env) => {
        const parent = env.getParent();
        if (!parent) {
            throw new Error("Can't set: no parent environment");
        }
        const name = env.get("name")(env).getValue();
        const value = env.get("value")(env).getValue();
        parent.def(name, value);
        return mkResult(value);
    }
    return bindParams(["name", "value"], defFn);
}

/**
 * Creates a set function
 * @returns 
 */
function makeSet() : EnvFn {
    const setFn = (env : Env) => set(env, env.get("name"), env.get("value"));
    return bindParams(["name", "value"], setFn);
}

function set(env : Env, nameFn : EnvFn, valueFn : EnvFn) : Result {
    const parentEnv = env.getParent();
    if (!parentEnv) {
        throw new Error("Can't set: no parent environment");
    }

    const name = nameFn(env).getValue();
    const value = valueFn(env).getValue();
    if (_.isString(name) || _.isSymbol(name) || isPath(name)) {
        parentEnv.set(name, value);
    } else {
        throw new Error("Can't set, " + name + " is an invalid setter path");
    }
    return mkResult(value);
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

    // Create the then/else methods.  exprResult is the result of the boolen expression, value is 
    // the current value to be returned.  The value is passed in via the then/else methods
    const mkThenElse = (exprResult : unknown, value : unknown) : ThenElse => {
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

function makeFn() : EnvFn {
    const fnFn : EnvFn = env => {
        const params = env.get("params")(env).getValue();
        const body = env.get("body");
        return mkResult(bindParams(params, body, env));
    }
    return bindParams(["params", "body"], fnFn);
}

/**
 * Switch statement
 * 
 * or could we do:
 * switch(expr)
 *  .case(1).then("foo")
 *  .case(2).then("bar")
 *  .case(3).case(4).then("baz")
 *  .default("qux")
 */
function makeSwitch() : EnvFn {
  type CaseThenDefault = {"case" : EnvFn, "then" : EnvFn, "default" : EnvFn };

  const mkCaseThenDefault = (exprResult : unknown, isMatch : boolean, value : unknown) 
                    : CaseThenDefault => {
    return {
        "case" : bindParams(["caseExpr"], (env : Env) => {
            // case(expr), record if it's a match
            const caseValue = env.get("caseExpr").resolve(env).getValue();           
            const newIsMatch = isMatch || caseValue === exprResult;
            const resultProps = mkCaseThenDefault(exprResult, newIsMatch, value);
            return mkResult(value, resultProps);
        }),
        "then" : bindParams(["thenExpr"], (env : Env) => {
            // then(expr) if isMatch set value, and reset isMatch
            const newValue = (isMatch)? env.get("thenExpr").resolve(env).getValue() : value;
            const resultProps = mkCaseThenDefault(exprResult, false, newValue);
            return mkResult(newValue, resultProps);
        }),
        "default" : bindParams(["defaultExpr"], (env : Env) => {
            // if value is undefined, set value to the default 
            const newValue = (_.isUndefined(value))? env.get("defaultExpr").resolve(env).getValue() : value;
            const resultProps = mkCaseThenDefault(exprResult, false, newValue);
            return mkResult(newValue, resultProps);
        })
    }
  } 

  const switchFn : EnvFn = env => {
    const exprResult = env.get("expr")(env).getValue();  
    const resultProps = mkCaseThenDefault(exprResult, false, undefined);
    return mkResult(undefined, resultProps);
  }

  return bindParams(["expr"], switchFn);
}

/* eslint-enable @typescript-eslint/no-explicit-any */
