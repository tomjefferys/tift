import { VarType, createRootEnv, mkObj } from "../src/env";

test("test empty env", () => {
    const env = createRootEnv();
    const test = () => env.get(VarType.STRING, "test");

    expect(test).toThrowError();
});

test("test simple set and get", () => {
    const env = createRootEnv();
    env.set("foo", "bar");
    const foo = env.get(VarType.STRING, "foo");
    expect(foo).toStrictEqual("bar");
})

test("test child env", () => {
    const root = createRootEnv();
    root.set("var1", "foo");
    root.set("var2", "bar");
    const child = root.newChild();
    child.set("var3", "baz");

    expect(root.get(VarType.STRING, "var1")).toEqual("foo");
    expect(root.get(VarType.STRING, "var2")).toEqual("bar");
    expect(() => root.get(VarType.STRING, "var3")).toThrowError();

    expect(child.get(VarType.STRING, "var1")).toEqual("foo");
    expect(child.get(VarType.STRING, "var2")).toEqual("bar");
    expect(child.get(VarType.STRING, "var3")).toEqual("baz");

    child.set("var1", "qux");

    expect(root.get(VarType.STRING, "var1")).toEqual("qux");
    expect(child.get(VarType.STRING, "var1")).toEqual("qux");

    root.set("var3", "quux");
    expect(root.get(VarType.STRING, "var3")).toEqual("quux");
    expect(child.get(VarType.STRING, "var3")).toEqual("baz");
})

test("test set/get an object", () => {
    const root = createRootEnv();
    root.set("obj1", {"foo":{"bar":"baz"}});
    const obj1 = root.get(VarType.OBJECT, "obj1");
    expect(obj1).toStrictEqual({"foo":{"bar":"baz"}});
})


test("test get with dot syntax", () => {
    const root = createRootEnv();
    root.set("obj1", {"foo":{"bar":"baz"}});
    const bar = root.get(VarType.STRING, "obj1.foo.bar");
    expect(bar).toEqual("baz");
})

test("test mkobj", () => {
    const obj = mkObj({"foo":{"bar":"baz"}});
    expect(obj).toStrictEqual({"foo":{"type":"OBJECT","value":{"bar":{"type":"STRING","value":"baz"}}}});
});

test("Set existing object with dot notation", () => {
    const root = createRootEnv();
    root.set("obj1", {"foo":{"bar":"baz"}});
    expect(root.get(VarType.STRING, "obj1.foo.bar")).toEqual("baz");
    root.set("obj1.foo.bar", "qux");
    expect(root.get(VarType.STRING, "obj1.foo.bar")).toEqual("qux");
});

test("Set missing object with dot notation", () => {
    const root = createRootEnv();
    root.set("obj1", {"foo": {}});
    root.set("obj1.foo.bar", "baz");
    expect(root.get(VarType.STRING, "obj1.foo.bar")).toEqual("baz");

    root.set("obj2", {});
    root.set("obj2.foo.bar", "baz");
    expect(root.get(VarType.STRING, "obj2.foo.bar")).toEqual("baz");
})