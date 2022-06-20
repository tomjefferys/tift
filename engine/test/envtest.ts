import { VarType, createRootEnv, mkObj } from "../src/env";

test("test empty env", () => {
    const env = createRootEnv({}, true);
    const test = () => env.get(VarType.STRING, "test");

    expect(test).toThrowError();
});

test("test simple set and get", () => {
    const env = createRootEnv({}, true);
    env.set("foo", "bar");
    const foo = env.get(VarType.STRING, "foo");
    expect(foo).toStrictEqual("bar");
})

test("test child env", () => {
    const root = createRootEnv({}, true);
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
    const root = createRootEnv({}, true);
    root.set("obj1", {"foo":{"bar":"baz"}});
    const obj1 = root.get(VarType.OBJECT, "obj1");
    expect(obj1).toStrictEqual({"foo":{"bar":"baz"}});
})


test("test get with dot syntax", () => {
    const root = createRootEnv({}, true);
    root.set("obj1", {"foo":{"bar":"baz"}});
    const bar = root.get(VarType.STRING, "obj1.foo.bar");
    expect(bar).toEqual("baz");
})

test("test mkobj", () => {
    const obj = mkObj({"foo":{"bar":"baz"}});
    expect(obj).toStrictEqual({"foo":{"type":"OBJECT","value":{"bar":{"type":"STRING","value":"baz"}}}});
});

test("Set existing object with dot notation", () => {
    const root = createRootEnv({}, true);
    root.set("obj1", {"foo":{"bar":"baz"}});
    expect(root.get(VarType.STRING, "obj1.foo.bar")).toEqual("baz");
    root.set("obj1.foo.bar", "qux");
    expect(root.get(VarType.STRING, "obj1.foo.bar")).toEqual("qux");
});

test("Set missing object with dot notation", () => {
    const root = createRootEnv({}, true);
    root.set("obj1", {"foo": {}});
    root.set("obj1.foo.bar", "baz");
    expect(root.get(VarType.STRING, "obj1.foo.bar")).toEqual("baz");

    root.set("obj2", {});
    root.set("obj2.foo.bar", "baz");
    expect(root.get(VarType.STRING, "obj2.foo.bar")).toEqual("baz");
})

test("Attempt to set a readonly env", () => {
    const root = createRootEnv({"foo":"bar"}, false);
    expect(() => root.set("baz","qux")).toThrowError();
    expect(() => root.set("foo", "qux")).toThrowError();
});

test("Test readonly root, and writable child", () => {
    const root = createRootEnv({"foo":"bar"}, false);
    const child = root.newChild();
    expect(root.get(VarType.STRING, "foo")).toEqual("bar");
    expect(child.get(VarType.STRING, "foo")).toEqual("bar");

    child.set("foo", "qux");
    expect(root.get(VarType.STRING, "foo")).toEqual("bar");
    expect(child.get(VarType.STRING, "foo")).toEqual("qux");
});

test("Test readonly root, correct descendent gets written to", () => {
    const root = createRootEnv({"foo":"bar"}, false);
    const child = root.newChild();
    const grandchild = child.newChild();

    expect(root.get(VarType.STRING, "foo")).toEqual("bar");
    expect(child.get(VarType.STRING, "foo")).toEqual("bar");
    expect(grandchild.get(VarType.STRING, "foo")).toEqual("bar");

    child.set("foo", "baz");
    expect(root.get(VarType.STRING, "foo")).toEqual("bar");
    expect(child.get(VarType.STRING, "foo")).toEqual("baz");
    expect(grandchild.get(VarType.STRING, "foo")).toEqual("baz");

    grandchild.set("foo", "qux");
    expect(root.get(VarType.STRING, "foo")).toEqual("bar");
    expect(child.get(VarType.STRING, "foo")).toEqual("qux");
    expect(grandchild.get(VarType.STRING, "foo")).toEqual("qux");

    grandchild.def("foo", "quux");
    expect(root.get(VarType.STRING, "foo")).toEqual("bar");
    expect(child.get(VarType.STRING, "foo")).toEqual("qux");
    expect(grandchild.get(VarType.STRING, "foo")).toEqual("quux");
});

test("Test readonly root, with complex object", () => {
    const root = createRootEnv({"foo":{"bar":{"baz":"qux"}}}, false);
    const child = root.newChild();

    expect(() => root.set("foo.bar.baz", "corge")).toThrowError();

    child.set("foo.bar.baz", "corge");
    expect(root.get(VarType.STRING, "foo.bar.baz")).toEqual("qux");
    expect(child.get(VarType.STRING, "foo.bar.baz")).toEqual("corge");
})

test("Test readonly deeply nested root, with complex object", () => {
    const root = createRootEnv({"foo":{"bar":"baz"}}, false);
    const child = root.newChild();
    const gchild = child.newChild();
    const ggchild = child.newChild();

    ggchild.set("foo.bar", "qux");

    expect(root.get(VarType.STRING, "foo.bar")).toEqual("baz");
    expect(child.get(VarType.STRING, "foo.bar")).toEqual("qux");
    expect(gchild.get(VarType.STRING, "foo.bar")).toEqual("qux");
    expect(ggchild.get(VarType.STRING, "foo.bar")).toEqual("qux");
    
});