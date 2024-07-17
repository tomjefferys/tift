import { Env } from "tift-types/src/env";
import { setUpEnv } from "./testutils/testutils";
import * as RuleBuilder from "../src/game/rulebuilder";
let env : Env;
let messages : string[];

beforeEach(() => {
    [env, messages] = setUpEnv();
});

test("Test simple rule", () => {
    const rule = "write('foo')";
    const thunk = RuleBuilder.evaluateRule(rule);
    thunk.resolve(env);
    expect(messages).toHaveLength(1);
    expect(messages).toContain("foo");
});

test("Test list", () => {
    const thunk = RuleBuilder.evaluateRule(["write('foo')", "write('bar')", "write('baz')"]);
    thunk.resolve(env);
    expect(messages).toStrictEqual(["foo", "bar", "baz"]);
});

test("Test nested list", () => {
    const thunk = RuleBuilder.evaluateRule(["write('foo')", ["write('bar')", "write('baz')"], "write('qux')"]);
    thunk.resolve(env);
    expect(messages).toStrictEqual(["foo", "bar", "baz", "qux"]);
})

test("Test repeat", () => {
    const thunk = RuleBuilder.evaluateRule({ "repeat" : ["write('foo')", "write('bar')", "write('baz')"] }, "myRule");
    const scope = env.newChild({ myRule : {}});
    thunk.resolve(scope);
    expect(messages).toStrictEqual(["foo"]);
    messages.length = 0;

    thunk.resolve(scope);
    expect(messages).toStrictEqual(["bar"]);
    messages.length = 0;
    
    thunk.resolve(scope);
    expect(messages).toStrictEqual(["baz"]);
    messages.length = 0;

    thunk.resolve(scope);
    expect(messages).toStrictEqual(["foo"]);
    messages.length = 0;
});

test("Test random", () => {
    const thunk = RuleBuilder.evaluateRule({ "random" : ["write('foo')", "write('bar')", "write('baz')"] });
    const expected = ["foo", "bar", "baz"];

    thunk.resolve(env);
    expect(messages).toHaveLength(1);
    expect(expected).toContain(messages[0]);
    messages.length = 0;
});

test("Test when", () => {
    const thunk = RuleBuilder.evaluateRule({
        "when" : "foo == 4",
        "repeat" : ["write('foo')", "write('bar')"],
        "otherwise" : "write('qux')"
    },"myRule");
    const ruleEnv = env.newChild({"myRule" : {}});

    thunk.resolve(ruleEnv.newChild({"foo" : 3}));
    expect(messages).toStrictEqual(["qux"]);
    messages.length = 0;

    thunk.resolve(ruleEnv.newChild({"foo" : 4}));
    expect(messages).toStrictEqual(["foo"]);
    messages.length = 0;

    thunk.resolve(ruleEnv.newChild({"foo" : 5}));
    expect(messages).toStrictEqual(["qux"]);
    messages.length = 0;

    thunk.resolve(ruleEnv.newChild({"foo" : 4}));
    expect(messages).toStrictEqual(["bar"]);
    messages.length = 0;

    thunk.resolve(ruleEnv.newChild({"foo" : 6}));
    expect(messages).toStrictEqual(["qux"]);
    messages.length = 0;

    thunk.resolve(ruleEnv.newChild({"foo" : 4}));
    expect(messages).toStrictEqual(["foo"]);
    messages.length = 0;
});