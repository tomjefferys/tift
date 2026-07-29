// Parsing/serializing layer for leaf expression strings - the individual
// command bodies inside a RuleValue "commands" list, or a "conditional"'s
// condition (see actions.ts). These are TIFT's javascript-like expression
// language (docs/expressionlanguage.md), parsed at runtime by
// engine/src/script/parser.ts using jsep. react-app must not import that
// engine-internal module, so this file uses its own copy of jsep (the same
// versions the engine pins - see engine/package.json) to parse expressions
// for editing purposes only; the engine remains the sole source of truth for
// actually evaluating them (surfaced via Input.validate on save).
//
// Only a bounded set of common shapes is modelled structurally: literals,
// entity/variable references, function calls, binary operations, and simple
// assignment. Anything else (closures via fn(), array literals, computed
// member access, comma sequences, member-chained calls like
// move(a).to(b)/if(x).then().else()/switch().case()) is preserved verbatim
// as a "raw" fallback rather than guessed at or mangled - the same principle
// actions.ts uses for unmodelled matchers/rules.
import jsep, {
    Expression, Literal, Identifier, MemberExpression, CallExpression,
    BinaryExpression, UnaryExpression, ArrayExpression, Compound, ConditionalExpression,
} from "jsep";
import * as jsepAssignmentModule from "@jsep-plugin/assignment";
import type { AssignmentExpression, UpdateExpression } from "@jsep-plugin/assignment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsepAssignment = ((jsepAssignmentModule as any).default ?? jsepAssignmentModule) as jsep.IPlugin;
jsep.plugins.register(jsepAssignment);
jsep.addBinaryOp("=>", 0);

export type LiteralType = "string" | "number" | "boolean";

export type BinaryOp = "==" | "!=" | ">" | "<" | ">=" | "<=" | "&&" | "||" | "+" | "-" | "*" | "/" | "%";
export const BINARY_OPS : BinaryOp[] = ["==", "!=", ">", "<", ">=", "<=", "&&", "||", "+", "-", "*", "/", "%"];

export type AssignOp = "=" | "+=" | "-=" | "*=" | "/=";
export const ASSIGN_OPS : AssignOp[] = ["=", "+=", "-=", "*=", "/="];

export type ExprValue =
    | { kind : "output", text : string }
    | { kind : "literal", type : LiteralType, value : string }
    | { kind : "ref", path : string }
    | { kind : "call", fn : string, args : ExprValue[] }
    | { kind : "operation", op : BinaryOp, left : ExprValue, right : ExprValue }
    | { kind : "assign", target : string, op : AssignOp, value : ExprValue }
    | { kind : "raw", text : string };

// A curated list of callable names offered as tap suggestions in "call" mode
// - transcribed from resources/stdlib.yaml and engine/src/game/enginedefault.ts's
// DEFAULT_FUNCTIONS. This is suggestions only (free text still allows any
// name), so it's fine if it drifts slightly from the engine's actual set;
// real errors are caught by Input.validate at save.
export const EXPR_FUNCTIONS : string[] = [
    // output
    "print", "say", "write", "writeMessage", "printAt", "error", "warn",
    // entities & tags
    "hasTag", "setTag", "delTag", "hide", "reveal", "getEntity", "getName", "getFullName",
    // movement & location
    "move", "getLocation", "setLocation", "openExit", "closeExit", "moveItemTo",
    "isAtLocation", "itemsAtLocation", "isInContainer",
    // player & score
    "getPlayer", "isCarrying", "isHolding", "getInventory", "score", "getScore", "gameOver",
    // openable
    "open", "close", "isOpenable",
    // logic & misc
    "not", "and", "or", "random", "tick", "pause", "clearBuffer", "obj",
    "getProperty", "getMetadata", "format", "return",
    // namespaces
    "Array.push", "Array.includes", "Array.indexOf", "Array.splice",
    "Math.floor", "Math.random", "String.includes",
];

// --- jsep AST -> ExprValue --------------------------------------------------

function mapLiteral(node : Literal) : ExprValue {
    const value = node.value;
    if (typeof value === "string") {
        return { kind : "literal", type : "string", value };
    }
    if (typeof value === "number") {
        return { kind : "literal", type : "number", value : String(value) };
    }
    if (typeof value === "boolean") {
        return { kind : "literal", type : "boolean", value : String(value) };
    }
    return { kind : "raw", text : stringifyJsep(node) };
}

// A dotted path built only from `this`/identifiers/non-computed member
// access (eg "this.isOpen", "player.score") - the shapes a reference or an
// assignment target can be. Anything else (computed access, a call as the
// object) returns undefined so the caller can fall back to raw.
function memberPath(node : Expression) : string | undefined {
    if (node.type === "ThisExpression") {
        return "this";
    }
    if (node.type === "Identifier") {
        return (node as Identifier).name;
    }
    if (node.type === "MemberExpression") {
        const member = node as MemberExpression;
        if (member.computed || member.property.type !== "Identifier") {
            return undefined;
        }
        const objectPath = memberPath(member.object);
        return objectPath === undefined ? undefined : `${objectPath}.${(member.property as Identifier).name}`;
    }
    return undefined;
}

function calleeName(node : Expression) : string | undefined {
    return node.type === "Identifier" ? (node as Identifier).name : memberPath(node);
}

function jsepToExpr(node : Expression) : ExprValue {
    switch (node.type) {
        case "Literal":
            return mapLiteral(node as Literal);
        case "Identifier":
            return { kind : "ref", path : (node as Identifier).name };
        case "ThisExpression":
            return { kind : "ref", path : "this" };
        case "MemberExpression": {
            const path = memberPath(node);
            return path !== undefined ? { kind : "ref", path } : { kind : "raw", text : stringifyJsep(node) };
        }
        case "CallExpression": {
            const call = node as CallExpression;
            const fn = calleeName(call.callee);
            return fn !== undefined
                ? { kind : "call", fn, args : call.arguments.map(jsepToExpr) }
                : { kind : "raw", text : stringifyJsep(node) };
        }
        case "BinaryExpression": {
            const binary = node as BinaryExpression;
            return (BINARY_OPS as string[]).includes(binary.operator)
                ? { kind : "operation", op : binary.operator as BinaryOp, left : jsepToExpr(binary.left), right : jsepToExpr(binary.right) }
                : { kind : "raw", text : stringifyJsep(node) };
        }
        case "AssignmentExpression": {
            const assignment = node as AssignmentExpression;
            const target = memberPath(assignment.left);
            return target !== undefined && (ASSIGN_OPS as string[]).includes(assignment.operator)
                ? { kind : "assign", target, op : assignment.operator as AssignOp, value : jsepToExpr(assignment.right) }
                : { kind : "raw", text : stringifyJsep(node) };
        }
        default:
            return { kind : "raw", text : stringifyJsep(node) };
    }
}

// Re-serializes a jsep AST node back into valid source text. Used to preserve
// unmodelled sub-expressions verbatim (as far as jsep's own parse allows -
// whitespace/quote-style may not be byte-identical, but is semantically
// equivalent, same as actions.ts's rule-value re-serialization).
function stringifyJsep(node : Expression) : string {
    switch (node.type) {
        case "Literal":
            return (node as Literal).raw;
        case "Identifier":
            return (node as Identifier).name;
        case "ThisExpression":
            return "this";
        case "MemberExpression": {
            const member = node as MemberExpression;
            return member.computed
                ? `${stringifyJsep(member.object)}[${stringifyJsep(member.property)}]`
                : `${stringifyJsep(member.object)}.${stringifyJsep(member.property)}`;
        }
        case "CallExpression": {
            const call = node as CallExpression;
            return `${stringifyJsep(call.callee)}(${call.arguments.map(stringifyJsep).join(", ")})`;
        }
        case "UnaryExpression": {
            const unary = node as UnaryExpression;
            return `${unary.operator}${stringifyJsep(unary.argument)}`;
        }
        case "UpdateExpression": {
            const update = node as UpdateExpression;
            return update.prefix ? `${update.operator}${stringifyJsep(update.argument)}` : `${stringifyJsep(update.argument)}${update.operator}`;
        }
        case "BinaryExpression": {
            const binary = node as BinaryExpression;
            return `${stringifyJsep(binary.left)} ${binary.operator} ${stringifyJsep(binary.right)}`;
        }
        case "AssignmentExpression": {
            const assignment = node as AssignmentExpression;
            return `${stringifyJsep(assignment.left)} ${assignment.operator} ${stringifyJsep(assignment.right)}`;
        }
        case "ArrayExpression": {
            const array = node as ArrayExpression;
            return `[${array.elements.map(el => el ? stringifyJsep(el) : "").join(", ")}]`;
        }
        case "Compound": {
            const compound = node as Compound;
            return compound.body.map(stringifyJsep).join(", ");
        }
        case "ConditionalExpression": {
            const conditional = node as ConditionalExpression;
            return `${stringifyJsep(conditional.test)} ? ${stringifyJsep(conditional.consequent)} : ${stringifyJsep(conditional.alternate)}`;
        }
        default:
            // Should not occur for anything jsep itself can produce - last resort.
            return JSON.stringify(node);
    }
}

// Parses a single expression string - a "commands" list entry, or a
// conditional's "condition" - into a structured ExprValue. A leading "$" is
// TIFT's "literal output text" convention (distinct from "$" = capture
// variable in matcher keys, a different grammar entirely - see actions.ts),
// not an expression, and is never passed to jsep.
export function parseExpression(text : string) : ExprValue {
    const trimmed = text.trim();
    if (trimmed.startsWith("$")) {
        return { kind : "output", text : trimmed.slice(1) };
    }
    try {
        const expr = jsepToExpr(jsep(trimmed));
        // Preserve the exact original text (not a jsep-reconstructed
        // approximation) when the whole expression itself isn't modelled.
        return expr.kind === "raw" ? { kind : "raw", text } : expr;
    } catch {
        return { kind : "raw", text };
    }
}

// --- ExprValue -> source text ----------------------------------------------

function quoteString(value : string) : string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

// Nested operations/assignments need explicit parens to preserve precedence
// once round-tripped through re-serialization (the original grouping isn't
// otherwise recoverable from the parsed model) - eg `5 * (6 - 2)`.
function serializeOperand(expr : ExprValue) : string {
    const text = serializeExpression(expr);
    return expr.kind === "operation" || expr.kind === "assign" ? `(${text})` : text;
}

export function serializeExpression(expr : ExprValue) : string {
    switch (expr.kind) {
        case "output":
            return "$" + expr.text;
        case "literal":
            return expr.type === "string" ? quoteString(expr.value) : expr.value;
        case "ref":
            return expr.path;
        case "call":
            return `${expr.fn}(${expr.args.map(serializeExpression).join(", ")})`;
        case "operation":
            return `${serializeOperand(expr.left)} ${expr.op} ${serializeOperand(expr.right)}`;
        case "assign":
            return `${expr.target} ${expr.op} ${serializeExpression(expr.value)}`;
        case "raw":
            return expr.text;
    }
}
