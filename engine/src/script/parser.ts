import jsep, {Expression, CallExpression, Identifier, Literal, BinaryExpression} from 'jsep';

//import { Expression, CallExpression, Identifier } from './exprtypes'
import { Env } from '../env'

export type EnvFn = (env : Env) => any;

export function parse(expression : string) : (env : Env) => any {
    const parseTree = jsep(expression);
    return evaluate(parseTree);
}

function evaluate(expression : Expression)  : (env : Env) => any {
    switch(expression.type) {
        case "CallExpression": 
            return evaluateCallExpression(expression as CallExpression);
        case "Identifier": 
            return evaluateIdentifier(expression as Identifier);
        case "Literal":
            return evaluateLiteral(expression as Literal);
        case "BinaryExpression":
            return evaluateBinaryExpression(expression as BinaryExpression);

    }
    throw new Error("Unknown expression type: " + expression.type);
}

function evaluateCallExpression(callExpression : CallExpression) : (env : Env) => any {
    const callee = evaluate(callExpression.callee);
    const args = callExpression.arguments
                            .map(e => evaluate(e));
    return env => callee(env)(env.newChild({"__args__" : args.map(arg => arg(env)) }))
    // Each arg is now a function that will return that arg value
    // How do we map an arg to it's param name
}

// TODO it should be part of the functions implementation, to map an arg array on to named parameters
// When a function is declared, the generated function is wrapped in an outer function that maps the parameters

function evaluateIdentifier(identifier : Identifier) : (env : Env) => void {

    //if (identifier.name === "print") {
    //    return makePrint();
    //    //return env => console.log(env.get("__args__")[0]);
    //}
    return env => env.get(identifier.name);
}

function evaluateBinaryExpression(expression : BinaryExpression)  : EnvFn {
    const left = evaluate(expression.left);
    const right = evaluate(expression.right);
    switch(expression.operator) {
        case "+":
            return env => left(env) + right(env);
        case "-":
            return env => left(env) - right(env);
        case "*":
            return env => left(env) * right(env);
        case "/":
            return env => left(env) / right(env);
        case "%":
            return env => left(env) % right(env);
        case "==":
            return env => left(env) === right(env);
        case "!=":
            return env => left(env) !== right(env);
        case ">":
            return env => left(env) > right(env);
        case "<":
            return env => left(env) < right(env);
        case ">=":
            return env => left(env) >= right(env);
        case "<=":
            return env => left(env) <= right(env);
        case "||":
            return env => left(env) || right(env);
        case "&&":
            return env => left(env) && right(env);
        case "|":
            return env => left(env) | right(env);
        case "&":
            return env => left(env) & right(env);
        case "^":
            return env => left(env) ^ right(env);
    }
    throw new Error("Unkown operator " + expression.operator);
}

function evaluateLiteral(literal : Literal) : (env : Env) => any {
    return env => literal.value;
}

function makePrint() : (env : Env) => any {
    const printFn : (env : Env) => any = env => console.log(env.get("value"))
    return env => bindParams(["value"], printFn)(env);
}

export function bindParams(params : string[], fn : EnvFn) : EnvFn {
    return env => {
        const namedArgs : {[key:string]:any}= {};
        const args = env.get("__args__");
        for(let i=0; i<args.length && i<params.length; i++) {
            namedArgs[params[i]] = args[i];
        }
        fn(env.newChild(namedArgs));
    }
}

