import _ from "lodash";
import { createRootEnv, OVERRIDE } from "../src/env";

test("test empty env", () => {
    const env = createRootEnv({}, "writable");
    const test = () => env.get("test");

    expect(test).toThrowError();
});

test("test simple set and get", () => {
    const env = createRootEnv({}, "writable");
    env.set("foo", "bar");
    const foo = env.get("foo");
    expect(foo).toStrictEqual("bar");
})

test("test child env", () => {
    const root = createRootEnv({}, "writable");
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
    const root = createRootEnv({}, "writable");
    root.set("obj1", {"foo":{"bar":"baz"}});
    const obj1 = root.get("obj1");
    expect(obj1).toStrictEqual({"foo":{"bar":"baz"}});
})


test("test get with dot syntax", () => {
    const root = createRootEnv({}, "writable");
    root.set("obj1", {"foo":{"bar":"baz"}});
    const bar = root.get("obj1.foo.bar");
    expect(bar).toEqual("baz");
})

test("Set existing object with dot notation", () => {
    const root = createRootEnv({}, "writable");
    root.set("obj1", {"foo":{"bar":"baz"}});
    expect(root.get("obj1.foo.bar")).toEqual("baz");
    root.set("obj1.foo.bar", "qux");
    expect(root.get("obj1.foo.bar")).toEqual("qux");
});

test("Set missing object with dot notation", () => {
    const root = createRootEnv({}, "writable");
    root.set("obj1", {"foo": {}});
    root.set("obj1.foo.bar", "baz");
    expect(root.get("obj1.foo.bar")).toEqual("baz");

    root.set("obj2", {});
    root.set("obj2.foo.bar", "baz");
    expect(root.get("obj2.foo.bar")).toEqual("baz");
})

test("Attempt to set a readonly env", () => {
    const root = createRootEnv({"foo":"bar"}, "readonly");
    expect(() => root.set("baz","qux")).toThrowError();
    expect(() => root.set("foo", "qux")).toThrowError();
});

test("Test readonly root, and writable child", () => {
    const root = createRootEnv({"foo":"bar"}, "readonly");
    const child = root.newChild();
    expect(root.get("foo")).toEqual("bar");
    expect(child.get("foo")).toEqual("bar");

    child.set("foo", "qux");
    expect(root.get("foo")).toEqual("bar");
    expect(child.get("foo")).toEqual("qux");
});

test("Test readonly root, correct descendent gets written to", () => {
    const root = createRootEnv({"foo":"bar"}, "readonly");
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
    const root = createRootEnv({"foo":{"bar":{"baz":"qux"}}}, "readonly");
    const child = root.newChild();

    expect(() => root.set("foo.bar.baz", "corge")).toThrowError();

    child.set("foo.bar.baz", "corge");
    expect(root.get("foo.bar.baz")).toEqual("qux");
    expect(child.get("foo.bar.baz")).toEqual("corge");
})

test("Test readonly root, with complex object, add new property", () => {
    const root = createRootEnv({"foo":{"bar":{"baz":"qux"}}}, "readonly");
    const child = root.newChild();

    child.set("foo.bar.corge", "grault");
    expect(root.get("foo.bar")).toEqual( {"baz":"qux"} );
    expect(child.get("foo.bar")).toEqual( {"baz":"qux", "corge":"grault"} );

});

test("Test readonly deeply nested root, with complex object", () => {
    const root = createRootEnv({"foo":{"bar":"baz"}}, "readonly");
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
    const root = createRootEnv({"foo":{"bar":"baz", "qux" : "corge"}}, "readonly");
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

test("Test get top level object that's been overridden", () => {
    const root = createRootEnv({"foo":{"bar":"baz", "qux":"corge"}}, "readonly");
    const child = root.newChild();

    child.set("foo.bar","grault");
    expect(root.get("foo")).toStrictEqual({"bar":"baz", "qux":"corge"});
    expect(child.get("foo")).toStrictEqual({"bar":"grault", "qux":"corge"});
});

test("Test deleting property", () => {
    const root = createRootEnv({"foo":{"bar":"baz", "qux":"corge"}}, "readonly");
    const child = root.newChild();

    child.set("foo.bar", null);
    expect(root.get("foo")).toStrictEqual({"bar":"baz", "qux":"corge"});
    expect(child.get("foo")).toStrictEqual({"qux":"corge"});
})

test("Test namespaces", () => {
    const obj = { 
        "foo" : {
            "bar" : "baz",
            "qux" : "corge"
        },
        "grault" : {
            "garply" : {
                "waldo" : "fred",
                "plugh" : "xyzzy"
            }
        }
    }

    const root = createRootEnv(obj, "readonly", [["foo"], ["grault", "garply"]]);
    const child = root.newChild();
    expect(root.getNamespaces()).toStrictEqual([[], ["foo"], ["grault", "garply"]]);
    expect(child.getNamespaces()).toStrictEqual([[], ["foo"], ["grault", "garply"]]);

    expect(root.matchNameSpace("foo")).toStrictEqual([["foo"],[]])
    expect(root.matchNameSpace("foo.bar")).toStrictEqual([["foo"],["bar"]]);

    expect(root.matchNameSpace("grault")).toStrictEqual([[],"grault"]);
    expect(root.matchNameSpace("grault.garply")).toStrictEqual([["grault", "garply"], []]);
    expect(root.matchNameSpace("grault.garply.waldo")).toStrictEqual([["grault", "garply"], ["waldo"]]);
});

test("Test namespace get", () => {
    const obj = { "foo" : {"bar" : {"baz" : "qux"} } };
    const root = createRootEnv(obj, "readonly", [["foo"]]);
    const child = root.newChild();

    expect(root.get("foo.bar")).toStrictEqual({"baz" : "qux"});
    expect(child.get("foo.bar")).toStrictEqual({"baz" : "qux"});
});

test("Test namespace, readonly root, writable child, set simple value", () => {
    const root = createRootEnv({"foo" : {"bar":"baz"}}, "readonly", [["foo"]]);
    const child = root.newChild();
    expect(root.get("foo.bar")).toEqual("baz");
    expect(child.get("foo.bar")).toEqual("baz");

    child.set("foo.bar", "qux");
    expect(root.get("foo.bar")).toEqual("baz");
    expect(child.get("foo.bar")).toEqual("qux");
});

test("Test namespace, readonly root, and writable child, set object property", () => {
    const root = createRootEnv({"foo" : {"bar":{"baz" : "qux"} } }, "readonly", [["foo"]]);
    const child = root.newChild();
    expect(root.get("foo.bar.baz")).toEqual("qux");
    expect(child.get("foo.bar.baz")).toEqual("qux");

    child.set("foo.bar.baz", "corge");
    expect(root.get("foo.bar.baz")).toEqual("qux");
    expect(child.get("foo.bar.baz")).toEqual("corge");

    expect(Reflect.ownKeys(child.properties["foo"])).not.toEqual(expect.arrayContaining([OVERRIDE]));
    expect(Reflect.ownKeys(child.properties["foo"]["bar"])).toEqual(expect.arrayContaining([OVERRIDE]));
});

test("Test find", () => {
    const root = createRootEnv({ "bar" : {"baz" : "qux"}, "corge" : {"baz" : "grault"} }, "readonly");
    const child = root.newChild();

    expect(root.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);
    expect(child.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);

    child.set("corge.baz", "qux");
    expect(root.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);
    expect(child.findObjs(obj => obj["baz"] === "qux")).toHaveLength(2);
})

test("Test find with namespace", () => {
    const root = createRootEnv({"namespace" : { "bar" : {"baz" : "qux"}, "corge" : {"baz" : "grault"} } }, "readonly", [["namespace"]]);
    const child = root.newChild();

    expect(root.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);
    expect(child.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);

    child.set("namespace.corge.baz", "qux");
    expect(root.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);
    expect(child.findObjs(obj => obj["baz"] === "qux")).toHaveLength(2);
})

// TODO test overlapping namespaces
// TODO test set simple property in namespace

