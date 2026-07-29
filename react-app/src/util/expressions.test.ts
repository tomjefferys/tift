import { describe, expect, test } from "vitest";
import { ExprValue, parseExpression, serializeExpression } from "./expressions";

function roundTrip(text : string) : string {
    return serializeExpression(parseExpression(text));
}

describe("parseExpression / serializeExpression", () => {
    test("string literal call", () => {
        const expr = parseExpression("print('You take it')");
        expect(expr).toEqual<ExprValue>({ kind : "call", fn : "print", args : [{ kind : "literal", type : "string", value : "You take it" }] });
        expect(serializeExpression(expr)).toBe("print('You take it')");
    });

    test("call with entity id and string arguments", () => {
        const expr = parseExpression("setTag(door, 'open')");
        expect(expr).toEqual<ExprValue>({
            kind : "call", fn : "setTag",
            args : [{ kind : "ref", path : "door" }, { kind : "literal", type : "string", value : "open" }],
        });
        expect(serializeExpression(expr)).toBe("setTag(door, 'open')");
    });

    test("simple assignment", () => {
        const expr = parseExpression("player.score = 100");
        expect(expr).toEqual<ExprValue>({ kind : "assign", target : "player.score", op : "=", value : { kind : "literal", type : "number", value : "100" } });
        expect(serializeExpression(expr)).toBe("player.score = 100");
    });

    test("enhanced assignment", () => {
        const expr = parseExpression("player.score += 1");
        expect(expr).toEqual<ExprValue>({ kind : "assign", target : "player.score", op : "+=", value : { kind : "literal", type : "number", value : "1" } });
        expect(serializeExpression(expr)).toBe("player.score += 1");
    });

    test("comparison operation", () => {
        const expr = parseExpression("a == b");
        expect(expr).toEqual<ExprValue>({ kind : "operation", op : "==", left : { kind : "ref", path : "a" }, right : { kind : "ref", path : "b" } });
        expect(serializeExpression(expr)).toBe("a == b");
    });

    test("logical operation over two calls", () => {
        expect(roundTrip("isCarrying(coin) && isHolding(key)")).toBe("isCarrying(coin) && isHolding(key)");
    });

    test("nested arithmetic operation preserves precedence with parens", () => {
        const expr = parseExpression("5 * (6 - 2)");
        expect(expr).toEqual<ExprValue>({
            kind : "operation", op : "*",
            left : { kind : "literal", type : "number", value : "5" },
            right : { kind : "operation", op : "-", left : { kind : "literal", type : "number", value : "6" }, right : { kind : "literal", type : "number", value : "2" } },
        });
        expect(serializeExpression(expr)).toBe("5 * (6 - 2)");
    });

    test("boolean literal", () => {
        const expr = parseExpression("true");
        expect(expr).toEqual<ExprValue>({ kind : "literal", type : "boolean", value : "true" });
        expect(serializeExpression(expr)).toBe("true");
    });

    test("dotted reference path", () => {
        const expr = parseExpression("this.isOpen");
        expect(expr).toEqual<ExprValue>({ kind : "ref", path : "this.isOpen" });
        expect(serializeExpression(expr)).toBe("this.isOpen");
    });

    test("bare identifier reference", () => {
        expect(roundTrip("coin")).toBe("coin");
    });

    test("literal output text ($ prefix)", () => {
        const expr = parseExpression("$You see a coin.");
        expect(expr).toEqual<ExprValue>({ kind : "output", text : "You see a coin." });
        expect(serializeExpression(expr)).toBe("$You see a coin.");
    });

    test("dotted callee (namespaced function)", () => {
        const expr = parseExpression("Array.push(x, coin)");
        expect(expr).toEqual<ExprValue>({
            kind : "call", fn : "Array.push",
            args : [{ kind : "ref", path : "x" }, { kind : "ref", path : "coin" }],
        });
        expect(serializeExpression(expr)).toBe("Array.push(x, coin)");
    });

    test("member-chained call falls back to raw, preserved verbatim", () => {
        const text = "move(player).to(cave)";
        const expr = parseExpression(text);
        expect(expr).toEqual<ExprValue>({ kind : "raw", text });
        expect(serializeExpression(expr)).toBe(text);
    });

    test("invalid/incomplete expression falls back to raw", () => {
        const text = "print('unterminated";
        const expr = parseExpression(text);
        expect(expr).toEqual<ExprValue>({ kind : "raw", text });
        expect(serializeExpression(expr)).toBe(text);
    });

    test("array literal falls back to raw", () => {
        const text = "['foo', 'bar']";
        const expr = parseExpression(text);
        expect(expr.kind).toBe("raw");
        expect(serializeExpression(expr)).toBe(text);
    });
});
