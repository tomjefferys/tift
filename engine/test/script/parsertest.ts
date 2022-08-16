import { toString } from "lodash";
import { start } from "../../src/command";
import { COMMAND } from "../../src/script/matchParser";
import { parse } from "../../src/script/parser"
import { APPLE, EAT, SOUP, STIR } from "../testutils/testentities";
import { setUpEnv } from "../testutils/testutils"

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

test("Test if then else", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("write(if(3 > 2).then('foo').else('bar'))");
    fn(env.newChild({}));
    expect(messages).toContain("foo");
    expect(messages).not.toContain("bar");
    messages.length = 0;

    const fn2 = parse("write(if(3 < 2).then('foo').else('bar'))");
    fn2(env.newChild({}));
    expect(messages).not.toContain("foo");
    expect(messages).toContain("bar");
})

test("Test if don't evaluate both sides", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("if(3 > 2).then(write('foo')).else(write('bar'))");
    fn(env.newChild({}));
    expect(messages).toContain("foo");
    expect(messages).not.toContain("bar");
    messages.length = 0;

    const fn2 = parse("if(3 < 2).then(write('foo')).else(write('bar'))");
    fn2(env.newChild({}));
    expect(messages).not.toContain("foo");
    expect(messages).toContain("bar");
});

test("Test empty do", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("do()");
    fn(env.newChild({}));
    expect(messages).toStrictEqual([]);
});

test("Test simple do", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("do(write('one'), write('two'), write('three'))");
    fn(env.newChild({}));
    expect(messages).toStrictEqual(["one", "two", "three"]);
});

test("Test simple set number", () => {
    const [env, _] = setUpEnv();
    const fn = parse("set(myVar, 1234)");
    fn(env);
    expect(env.get("myVar")).toEqual(1234);
});

test("Test do with set", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            set(myVar, 'foo'),
            write(myVar) )`);
    fn(env);
    expect(messages).toStrictEqual(["foo"]);
});

test("Test do with set with expression", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            set(a, 3),
            set(b, a + 7),
            write(a),
            write(b)
        )`);
    fn(env);
    expect(messages).toStrictEqual(["3", "10"]);
});

test("Test do scoping", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            def(a,"foo"),
            def(b,"bar"),
            do(
                def(a,"baz"),
                write(a),
                write(b),
                set(b,"qux")
            ),
            write(a),
            write(b)
        )
    `);
    fn(env);
    expect(messages).toStrictEqual(["baz","bar","foo","qux"]);
});

test("Test array", () => {
    const [env, _] = setUpEnv();
    const fn = parse(`set(arr, ["foo","bar"])`);
    fn(env);
    const arr = env.get("arr");
    expect(arr).toStrictEqual(["foo","bar"]);
});

test("Test array access", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            set(arr, ["foo", "bar"]),
            write(arr[1]),
            write(arr[0])
        )
    `);
    fn(env);
    expect(messages).toStrictEqual(["bar", "foo"]);
});

test("Test match operator, successful match", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("stir($self) => write('you stir the ' + self)");
    const command = start().verb(STIR).object(SOUP);
    fn(env.newChild({[COMMAND]: command}));
    expect(messages).toContain("you stir the soup");
})

test("Test match operator, unsuccessful match", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("stir($self) => write('you stir the ' + self)");
    const command = start().verb(EAT).object(APPLE);
    fn(env.newChild({[COMMAND]: command}));
    expect(messages.length).toBe(0);
})

test("Test match operator, return string", () => {
    const [env, messages] = setUpEnv();
    const fn = parse("stir($self) => 'you stir the ' + self");
    const command = start().verb(STIR).object(SOUP);
    const result = fn(env.newChild({[COMMAND]: command}));
    expect(messages.length).toBe(0);
    expect(result).toEqual("you stir the soup");
})