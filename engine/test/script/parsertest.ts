import { parse, bindParams } from "../../src/script/parser"
import { Env, createRootEnv, EnvFn } from "../../src/env"
import { print } from "../../src/messages/output"
import { listOutputConsumer } from "../testutils"

test("Test parameter binding", () => {
    const [env, messages] = setUpEnv();
    env.get("write")(env.newChild({"__args__": ["Hello World"]}));
    console.log(messages);
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


function setUpEnv() : [Env, string[]] {
    const messages : string[] = [];
    const env = createRootEnv({"OUTPUT":listOutputConsumer(messages)}, true);
    const write : EnvFn = bindParams(["value"], env => env.get("OUTPUT")(print(env.get("value"))));
    env.set("write", write);
    return [env, messages];
}