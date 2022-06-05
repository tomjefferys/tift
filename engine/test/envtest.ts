import { createRootEnv } from ".././src/env";

test("test empty env", () => {
    const env = createRootEnv();
    const test = () => env.get("test");

    expect(test).toThrowError();
});

test("test simple set and get", () => {
    const env = createRootEnv();
    env.set("foo", "bar");
    const foo = env.get("foo");
    expect(foo).toStrictEqual("bar");
})

test("test child env", () => {
    const root = createRootEnv();
    root.set("var1", "foo");
    root.set("var2", "bar");
    const child = root.newChild();
    child.set("var3", "baz");

    expect(root.get("var1")).toEqual("foo");
    expect(root.get("var2")).toEqual("bar");
    expect(() => root.get("var3")).toThrowError();

    expect(child.get("var1")).toEqual("foo");
    expect(child.get("var2")).toEqual("bar");
    expect(child.get("var3")).toEqual("baz");

    child.set("var1", "qux");

    expect(root.get("var1")).toEqual("qux");
    expect(child.get("var1")).toEqual("qux");

    root.set("var3", "quux");
    expect(root.get("var3")).toEqual("quux");
    expect(child.get("var3")).toEqual("baz");
})
