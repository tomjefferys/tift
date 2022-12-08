import { AssignmentExpression } from "@jsep-plugin/assignment";
import { ArrayExpression, BinaryExpression, CallExpression, Compound, Expression, Identifier, Literal, MemberExpression, UnaryExpression } from "jsep";

export function exprToString(expr? : Expression) : string {
    if (!expr) {
        return "";
    }
    let str = "";
    switch(expr.type) {
        case "Identifier":
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
        case "Compound": {
                const compound = expr as Compound;
                str = "(" + compound.body.map(element => exprToString(element)).join(", ") + ")";
            }
            break;
        case "AssignmentExpression": {
                const assignment = expr as AssignmentExpression;
                str = exprToString(assignment.left) + assignment.operator + exprToString(assignment.right);
            }
            break;
        default: 
            str = "unknown expression type " + expr.type;
    }
    return str;
}