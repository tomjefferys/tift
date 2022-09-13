import { Compound, Expression, Identifier, Literal, MemberExpression } from "jsep";
import _ from "lodash";
import { index, Path, property } from "../path";
import { exprToString } from "./expressionutils";
import { parseToTree } from "./parser";

type PathFn = (expr : Expression) => Path;

type ParseInput = string | symbol;

const PARSE_FUNCTIONS : {[key:string]:PathFn} = {
    "Identifier" : expr => [property((expr as Identifier).name)],
    "ThisExpression" : _expr => [property("this")],
    "Literal" : expr => parsePathLiteral(expr as Literal),
    "MemberExpression" : expr => parseMemberExpression(expr as MemberExpression),
    "Compound" : expr => parseCompound(expr as Compound)
}

export function parsePath(pathStr : ParseInput) : Path {
    let path : Path;
    if (_.isString(pathStr)) {
        const expression = parseToTree(pathStr);
        path = parsePathExpr(expression);
    } else {
        path = [property(pathStr)];
    }
    return path;
}

export function parsePathExpr(expr : Expression) : Path {
    if (_.has(PARSE_FUNCTIONS, expr.type)) {
        return PARSE_FUNCTIONS[expr.type](expr);
    } 
    throw new Error("Unsupported path expression: " + exprToString(expr))
}

function parsePathLiteral(literal : Literal) : Path {
    if (_.isInteger(literal.value)) {
        return [index(literal.value as number)];
    } else if (_.isString(literal.value)) {
        return [property(literal.value as string)];
    } else {
    throw new Error("Bad literal type in path: " + exprToString(literal));
    }
}

function parseMemberExpression(expr : MemberExpression) : Path {
    const start = parsePathExpr(expr.object);
    const end = parsePathExpr(expr.property);
    return [...start, ...end];
}

function parseCompound(compound : Compound) {
    const path : Path = [];
    compound.body.forEach(expr => path.concat(parsePathExpr(expr)))
    return path;
}