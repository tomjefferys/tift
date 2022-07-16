import { parse, bindParams, makeIf } from "../../src/script/parser"
import { Env, createRootEnv, EnvFn } from "../../src/env"
import { print } from "../../src/messages/output"
import { listOutputConsumer } from "../testutils/testutils"

test("Test parameter binding", () => {
    const [env, messages] = setUpEnv();
    env.get("write")(env.newChild({"__args__": ["Hello World"]}));
    expect(messages).toContain("Hello World");
});

test("Test simple write expression", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("write('foo bar')");
    fn(env);
    expect(messages).toContain("foo bar");
});

test("Test boolean expression", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("write(foo == 3)");
    fn(env.newChild({"foo" : 3}));
    expect(messages).toContain("true");
});

test("Test basic arithmetic exprssion", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("write(a * (b + 3))");
    fn(env.newChild({"a": 2, "b": 3}));
    expect(messages).toContain("12");
});

test("Test if", () => {
    const [env, messages] = setUpEnv();
    env.set("if", makeIf());
    const fn = parse("write(if(3 > 2).then('foo').else('bar'))")
    fn(env.newChild({}));
    expect(messages).toContain("foo");
})


function setUpEnv() : [Env, string[]] {
    const messages : string[] = [];
    const env = createRootEnv({"OUTPUT":listOutputConsumer(messages)}, true);
    const write : EnvFn = bindParams(["value"], env => {
        const value = env.get("value")
        return env.get("OUTPUT")(print(value));
    });
    env.set("write", write);
    return [env, messages];
}