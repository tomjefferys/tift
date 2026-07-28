import { parseMatcher, serializeMatcher, Matcher, parseRuleValue, serializeRuleValue, RuleValue,
         parseActionBlock, serializeActionBlock } from "./actions";

function roundTrip(text : string) : Matcher {
    const matcher = parseMatcher(text);
    expect(serializeMatcher(matcher)).toBe(text);
    return matcher;
}

test("parses and round-trips a bare intransitive verb", () => {
    const matcher = roundTrip("look");
    expect(matcher).toEqual({ kind : "pattern", verb : "look", directObject : undefined, modifiers : [], attribute : undefined });
});

test("parses and round-trips a verb matching `this`", () => {
    const matcher = roundTrip("get(this)");
    expect(matcher).toEqual({
        kind : "pattern",
        verb : "get",
        directObject : { kind : "this" },
        modifiers : [],
        attribute : undefined,
    });
});

test("parses and round-trips a captured modifier with no direct object", () => {
    const matcher = roundTrip("go($direction)");
    expect(matcher).toEqual({
        kind : "pattern",
        verb : "go",
        directObject : { kind : "capture", name : "direction" },
        modifiers : [],
        attribute : undefined,
    });
});

test("parses and round-trips an attributed verb with a capturing indirect object", () => {
    const matcher = roundTrip("ask(this).about($topic)");
    expect(matcher).toEqual({
        kind : "pattern",
        verb : "ask",
        directObject : { kind : "this" },
        modifiers : [],
        attribute : { name : "about", indirectObject : { kind : "capture", name : "topic" } },
    });
});

test("parses and round-trips a direct object plus a captured modifier", () => {
    const matcher = roundTrip("push($box, $direction)");
    expect(matcher).toEqual({
        kind : "pattern",
        verb : "push",
        directObject : { kind : "capture", name : "box" },
        modifiers : [{ kind : "capture", name : "direction" }],
        attribute : undefined,
    });
});

test("parses and round-trips a literal id argument", () => {
    const matcher = roundTrip("push(theBox)");
    expect(matcher).toEqual({
        kind : "pattern",
        verb : "push",
        directObject : { kind : "id", id : "theBox" },
        modifiers : [],
        attribute : undefined,
    });
});

test("falls back to a raw matcher for text it can't confidently model", () => {
    const matcher = parseMatcher("push(this, !invalid)");
    expect(matcher).toEqual({ kind : "raw", text : "push(this, !invalid)" });
    expect(serializeMatcher(matcher)).toBe("push(this, !invalid)");
});

test("normalises explicit empty parens on save (cosmetic only, same meaning to the engine)", () => {
    const matcher = parseMatcher("look()");
    expect(serializeMatcher(matcher)).toBe("look");
});

function ruleRoundTrip(value : unknown) : RuleValue {
    const rv = parseRuleValue(value);
    expect(serializeRuleValue(rv)).toEqual(value);
    return rv;
}

test("parses and round-trips a single-command rule string", () => {
    const rv = ruleRoundTrip("print('You take it')");
    expect(rv).toEqual({ kind : "commands", commands : ["print('You take it')"] });
});

test("parses and round-trips a multi-command rule list", () => {
    const rv = ruleRoundTrip(["print('one')", "print('two')", "print('three')"]);
    expect(rv).toEqual({ kind : "commands", commands : ["print('one')", "print('two')", "print('three')"] });
});

test("parses and round-trips a when/then/otherwise conditional, canonicalising then->do", () => {
    const rv = parseRuleValue({ when : "isHolding(candle)", then : "print('You see vast treasures')", otherwise : "print('It is dark')" });
    expect(rv).toEqual({
        kind : "conditional",
        condType : "when",
        condition : "isHolding(candle)",
        action : { kind : "commands", commands : ["print('You see vast treasures')"] },
        otherwise : { kind : "commands", commands : ["print('It is dark')"] },
    });
    // "then" is canonicalised to "do" on save - same meaning to the engine.
    expect(serializeRuleValue(rv)).toEqual({ when : "isHolding(candle)", do : "print('You see vast treasures')", otherwise : "print('It is dark')" });
});

test("parses and round-trips a switch of when/do cases with no outer condition", () => {
    const value = {
        switch : [
            { when : "direction == 'up'", do : "print('The mechanism whirs')" },
            { when : "direction == 'down'", do : "print('The mechanism hums')" },
        ],
    };
    const rv = ruleRoundTrip(value);
    expect(rv.kind).toBe("switch");
});

test("parses and round-trips a once clause", () => {
    const rv = ruleRoundTrip({ once : "score(1)" });
    expect(rv).toEqual({ kind : "once", action : { kind : "commands", commands : ["score(1)"] } });
});

test("falls back to raw for an object with conflicting roles (eg both when and if)", () => {
    const value = { when : "a", if : "b", do : "print('x')" };
    const rv = parseRuleValue(value);
    expect(rv).toEqual({ kind : "raw", value });
    expect(serializeRuleValue(rv)).toEqual(value);
});

test("falls back to raw for a list containing non-string entries", () => {
    const value = ["print('a')", { when : "x", do : "y" }];
    const rv = parseRuleValue(value);
    expect(rv).toEqual({ kind : "raw", value });
});

test("parseActionBlock/serializeActionBlock normalise a single Matcher => Command string into map form", () => {
    const clauses = parseActionBlock("get(this) => print('You take it')");
    expect(clauses).toEqual([{
        matcher : { kind : "pattern", verb : "get", directObject : { kind : "this" }, modifiers : [], attribute : undefined },
        rule : { kind : "commands", commands : ["print('You take it')"] },
    }]);
    expect(serializeActionBlock(clauses)).toEqual({ "get(this)" : "print('You take it')" });
});

test("parseActionBlock/serializeActionBlock normalise an array of Matcher => Command strings into map form", () => {
    const clauses = parseActionBlock([
        "get(this) => print('a')",
        "drop(this) => print('b')",
    ]);
    expect(clauses).toHaveLength(2);
    expect(serializeActionBlock(clauses)).toEqual({ "get(this)" : "print('a')", "drop(this)" : "print('b')" });
});

test("parseActionBlock/serializeActionBlock round-trip a matcher-keyed map with a component rule", () => {
    const raw = {
        "push(this, $direction)": { when : "sat_on", do : "print('You need to get off the chair')" },
    };
    const clauses = parseActionBlock(raw);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].matcher).toEqual({
        kind : "pattern", verb : "push", directObject : { kind : "this" },
        modifiers : [{ kind : "capture", name : "direction" }], attribute : undefined,
    });
    expect(serializeActionBlock(clauses)).toEqual({ "push(this, $direction)" : { when : "sat_on", do : "print('You need to get off the chair')" } });
});

test("parseActionBlock returns an empty list for an absent block", () => {
    expect(parseActionBlock(undefined)).toEqual([]);
});
