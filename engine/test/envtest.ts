import { createRootEnv } from "../src/env";

test("test empty env", () => {
    const env = createRootEnv({}, true);
    const test = () => env.get("test");

    expect(test).toThrowError();
});

test("test simple set and get", () => {
    const env = createRootEnv({}, true);
    env.set("foo", "bar");
    const foo = env.get("foo");
    expect(foo).toStrictEqual("bar");
})

test("test child env", () => {
    const root = createRootEnv({}, true);
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

test("test set/get an object", () => {
    const root = createRootEnv({}, true);
    root.set("obj1", {"foo":{"bar":"baz"}});
    const obj1 = root.get("obj1");
    expect(obj1).toStrictEqual({"foo":{"bar":"baz"}});
})


test("test get with dot syntax", () => {
    const root = createRootEnv({}, true);
    root.set("obj1", {"foo":{"bar":"baz"}});
    const bar = root.get("obj1.foo.bar");
    expect(bar).toEqual("baz");
})

test("Set existing object with dot notation", () => {
    const root = createRootEnv({}, true);
    root.set("obj1", {"foo":{"bar":"baz"}});
    expect(root.get("obj1.foo.bar")).toEqual("baz");
    root.set("obj1.foo.bar", "qux");
    expect(root.get("obj1.foo.bar")).toEqual("qux");
});

test("Set missing object with dot notation", () => {
    const root = createRootEnv({}, true);
    root.set("obj1", {"foo": {}});
    root.set("obj1.foo.bar", "baz");
    expect(root.get("obj1.foo.bar")).toEqual("baz");

    root.set("obj2", {});
    root.set("obj2.foo.bar", "baz");
    expect(root.get("obj2.foo.bar")).toEqual("baz");
})

test("Attempt to set a readonly env", () => {
    const root = createRootEnv({"foo":"bar"}, false);
    expect(() => root.set("baz","qux")).toThrowError();
    expect(() => root.set("foo", "qux")).toThrowError();
});

test("Test readonly root, and writable child", () => {
    const root = createRootEnv({"foo":"bar"}, false);
    const child = root.newChild();
    expect(root.get("foo")).toEqual("bar");
    expect(child.get("foo")).toEqual("bar");

    child.set("foo", "qux");
    expect(root.get("foo")).toEqual("bar");
    expect(child.get("foo")).toEqual("qux");
});

test("Test readonly root, correct descendent gets written to", () => {
    const root = createRootEnv({"foo":"bar"}, false);
    const child = root.newChild();
    const grandchild = child.newChild();

    expect(root.get("foo")).toEqual("bar");
    expect(child.get("foo")).toEqual("bar");
    expect(grandchild.get("foo")).toEqual("bar");

    child.set("foo", "baz");
    expect(root.get("foo")).toEqual("bar");
    expect(child.get("foo")).toEqual("baz");
    expect(grandchild.get("foo")).toEqual("baz");

    grandchild.set("foo", "qux");
    expect(root.get("foo")).toEqual("bar");
    expect(child.get("foo")).toEqual("qux");
    expect(grandchild.get("foo")).toEqual("qux");

    grandchild.def("foo", "quux");
    expect(root.get("foo")).toEqual("bar");
    expect(child.get("foo")).toEqual("qux");
    expect(grandchild.get("foo")).toEqual("quux");
});

test("Test readonly root, with complex object", () => {
    const root = createRootEnv({"foo":{"bar":{"baz":"qux"}}}, false);
    const child = root.newChild();

    expect(() => root.set("foo.bar.baz", "corge")).toThrowError();

    child.set("foo.bar.baz", "corge");
    expect(root.get("foo.bar.baz")).toEqual("qux");
    expect(child.get("foo.bar.baz")).toEqual("corge");
})

test("Test readonly deeply nested root, with complex object", () => {
    const root = createRootEnv({"foo":{"bar":"baz"}}, false);
    const child = root.newChild();
    const gchild = child.newChild();
    const ggchild = child.newChild();

    ggchild.set("foo.bar", "qux");

    expect(root.get("foo.bar")).toEqual("baz");
    expect(child.get("foo.bar")).toEqual("qux");
    expect(gchild.get("foo.bar")).toEqual("qux");
    expect(ggchild.get("foo.bar")).toEqual("qux");
    
});

test("Test get parent object props after child overridden", () => {
    const root = createRootEnv({"foo":{"bar":"baz", "qux" : "corge"}}, false);
    const child = root.newChild();
    const gchild = child.newChild();

    gchild.set("foo.bar", "grault");
    expect(root.get("foo.bar")).toEqual("baz");
    expect(root.get("foo.qux")).toEqual("corge");
   
    expect(child.get("foo.bar")).toEqual("grault");
    expect(child.get("foo.qux")).toEqual("corge");

    expect(gchild.get("foo.bar")).toEqual("grault");
    expect(gchild.get("foo.qux")).toEqual("corge");
});