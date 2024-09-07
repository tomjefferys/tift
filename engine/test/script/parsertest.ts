import { start } from "../../src/command";
import { parse } from "../../src/script/parser"
import { phaseActionBuilder } from "../../src/script/phaseaction";
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

test("Test switch", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            set(a, 2),
            switch(a)
                .case(1).then(write('one'))
                .case(2).then(write('two'))
                .default('three')
        )
    `);
    fn(env.newChild({}));
    expect(messages).toStrictEqual(['two']);
});

test("Test switch return result", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            set(a, 2),
            set(b, switch(a)
                    .case(1).then('one')
                    .case(2).then('two')
                    .default('three')),
            write(b)
        )
    `);
    fn(env.newChild({}));
    expect(messages).toStrictEqual(['two']);
})

test("Test switch default value", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
    do(
        set(a, 3),
        set(b, switch(a)
                .case(1).then('one')
                .case(2).then('two')
                .default('three')),
        write(b)
    )
    `);
    fn(env.newChild({}));
    expect(messages).toStrictEqual(['three']);
})

test("Test switch fall through", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            set(a,1),
            set(b, switch(a)
                        .case(1).case(2).then("one or two")
                        .default('three')),
            write(b)
        )
    `)
    fn(env.newChild({}));
    expect(messages).toStrictEqual(['one or two']);
})

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

test("Test array access with expression", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            set(arr, ["foo", "bar"]),
            set(index, 1),
            write(arr[index])
        )
    `);
    fn(env);
    expect(messages).toStrictEqual(["bar"]);
});

test("Test object property", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            set(player.score, 100),
            write(player.score)
        )
    `)
    fn(env);
    expect(messages).toStrictEqual(["100"]);
});

test("Test set array item", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            set(obj.arr, ["foo", "bar"]),
            set(obj.arr[0], "baz"),
            write(obj.arr[0]),
            write(obj.arr[1])
        )
    `)
    fn(env);
    expect(messages).toStrictEqual(["baz", "bar"]);
})

test("Test assignment", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            a = 3,
            b = a + 7,
            write(a),
            write(b)
        )
    `);
    fn(env);
    expect(messages).toStrictEqual(["3", "10"]);
});

test("Test assignment, set object property", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            player.score = 100,
            write(player.score)
        )
    `)
    fn(env);
    expect(messages).toStrictEqual(["100"]);
});

test("Test assignment, set array item", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            obj.arr = ["foo", "bar"],
            obj.arr[0] = "baz",
            write(obj.arr[0]),
            write(obj.arr[1])
        )
    `)
    fn(env);
    expect(messages).toStrictEqual(["baz", "bar"]);
})

test("Test enhanced assignment", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            a = 2,
            b = 4,
            b *= a,
            a += 5 + 5,
            write(a),
            write(b)
        )
    `)
    fn(env);
    expect(messages).toStrictEqual(["12", "8"]);
});

test("Test unary expression", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            a = 2,
            b = false,
            write(-a),
            write(-(-a)),
            write(!b),
            write(!!b)
        )
    `)
    fn(env);
    expect(messages).toStrictEqual(["-2", "2", "true", "false"]);
});

test("Test this expression", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
        do(
            this = "hello ",
            this += "world",
            write(this)
        )
    `)
    fn(env);
    expect(messages).toStrictEqual(["hello world"]);
})

test("Test compound", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
            set(a, 3),
            set(b, a + 7),
            write(a),
            write(b),
            a + b
        `);
    const result = fn(env);
    expect(result).toBe(13);
    expect(messages).toStrictEqual(["3", "10"]);
})

test("Test simple function definition", () => {
    const [env, _] = setUpEnv();
    const fn = parse(`
        def(add, fn([param1, param2], param1 + param2)),
        add(2,3)
    `)
    const result = fn(env);
    expect(result).toBe(5);
})

test("Test function, simple closure", () => {
    const [env, _messages] = setUpEnv();
    const fn = parse(`
        def(createAdd, fn([param1], do(
            fn([param2], param1 + param2)
        ))),
        def(addSeven, createAdd(7)),
        addSeven(3)
    `);
    const result = fn(env);
    expect(result).toBe(10);
})

test("Test function, nested closures", () => {
    const [env, _messages] = setUpEnv();
    const fn = parse(`
        def(createAdd, fn([param1], do(
            def(nestedAdd, fn([param2], param1 + param2)),
            fn([param3], nestedAdd(2) + param3)
        ))),
        def(addSeven, createAdd(7)),
        addSeven(3)
    `);
    const result = fn(env);
    expect(result).toBe(12);
})

test("Test match operator, successful match", () => {
    const [env, messages] = setUpEnv();
    const action =  phaseActionBuilder()
        .withPhase("main")
        .withExpression("stir($self) => write('you stir the ' + self.id)");

    const command = start().verb(STIR).object(SOUP);
    action.perform(env, APPLE, command);
    expect(messages).toContain("you stir the soup");
})

test("Test match operator, unsuccessful match", () => {
    const [env, messages] = setUpEnv();
    const action = phaseActionBuilder()
        .withPhase("main")
        .withExpression("stir($self) => write('you stir the ' + self)");
    const command = start().verb(EAT).object(APPLE);
    action.perform(env, APPLE, command);
    expect(messages.length).toBe(0);
})

test("Test match operator, return string", () => {
    const [env, messages] = setUpEnv();
    const action = phaseActionBuilder()
            .withPhase("main")
            .withExpression("stir($self) => 'you stir the ' + self.id");
    const command = start().verb(STIR).object(SOUP);
    const result = action.perform(env, SOUP, command);
    expect(messages.length).toBe(0);
    expect(result.getValue()).toEqual("you stir the soup");
})

test("Test match operator using 'this'", () => {
    const [env, messages] = setUpEnv();
    const action = phaseActionBuilder()
            .withPhase("main")
            .withExpression("stir(this) => 'you stir the soup'");
    const command = start().verb(STIR).object(SOUP);
    const result = action.perform(env, SOUP, command);
    expect(messages.length).toBe(0);
    expect(result.getValue()).toEqual("you stir the soup");
})

test("Test match operator using 'this', not a match", () => {
    const [env, messages] = setUpEnv();
    const action = phaseActionBuilder()
            .withPhase("main")
            .withExpression("stir(this) => 'you stir the soup'");
    const command = start().verb(STIR).object(SOUP);
    const result = action.perform(env, APPLE, command);
    expect(messages.length).toBe(0);
    expect(result.getValue()).toBeFalsy();
})

test("Test mustache expansion", () => {
    const [env, messages] = setUpEnv();
    const fn = parse(`
            set(a, 3),
            set(b, a + 7),
            write("{{a}} plus 7 equals {{b}}"),
        `);
    fn(env);
    expect(messages).toContain("3 plus 7 equals 10");
});