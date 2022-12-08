import _ from "lodash";
import { createRootEnv, isFound, NameSpace, Obj } from "../src/env";
import { Path, toValueList } from "../src/path";

test("test empty env", () => {
    const env = createRootEnv({});
    const result = env.get("test");
    expect(isFound(result)).toBeFalsy();
});

test("test simple set and get", () => {
    const env = createRootEnv({});
    env.set("foo", "bar");
    const foo = env.get("foo");
    expect(foo).toStrictEqual("bar");
})

test("test child env", () => {
    const root = createRootEnv({});
    root.set("var1", "foo");
    root.set("var2", "bar");
    const child = root.newChild();
    child.set("var3", "baz");

    expect(root.get("var1")).toEqual("foo");
    expect(root.get("var2")).toEqual("bar");
    expect(isFound(root.get("var3"))).toBeFalsy();

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
    const root = createRootEnv({});
    root.set("obj1", {"foo":{"bar":"baz"}});
    const obj1 = root.get("obj1");
    expect(obj1).toStrictEqual({"foo":{"bar":"baz"}});
})


test("test get with dot syntax", () => {
    const root = createRootEnv({});
    root.set("obj1", {"foo":{"bar":"baz"}});
    const bar = root.get("obj1.foo.bar");
    expect(bar).toEqual("baz");
})

test("Set existing object with dot notation", () => {
    const root = createRootEnv({});
    root.set("obj1", {"foo":{"bar":"baz"}});
    expect(root.get("obj1.foo.bar")).toEqual("baz");
    root.set("obj1.foo.bar", "qux");
    expect(root.get("obj1.foo.bar")).toEqual("qux");
});

test("Set missing object with dot notation", () => {
    const root = createRootEnv({});
    root.set("obj1", {"foo": {}});
    root.set("obj1.foo.bar", "baz");
    expect(root.get("obj1.foo.bar")).toEqual("baz");

    root.set("obj2", {});
    root.set("obj2.foo.bar", "baz");
    expect(root.get("obj2.foo.bar")).toEqual("baz");
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

    const root = createRootEnv(obj, [["foo"], ["grault", "garply"]]);
    const child = root.newChild();
    expect(root.getNamespaces()).toStrictEqual([[], ["foo"], ["grault", "garply"]]);
    expect(child.getNamespaces()).toStrictEqual([[], ["foo"], ["grault", "garply"]]);

    expect(resultToValueList(root.matchNameSpace("foo"))).toStrictEqual([["foo"],[]])
    expect(resultToValueList(root.matchNameSpace("foo.bar"))).toStrictEqual([["foo"],["bar"]]);

    expect(resultToValueList(root.matchNameSpace("grault"))).toStrictEqual([[],["grault"]]);
    expect(resultToValueList(root.matchNameSpace("grault.garply"))).toStrictEqual([["grault", "garply"], []]);
    expect(resultToValueList(root.matchNameSpace("grault.garply.waldo"))).toStrictEqual([["grault", "garply"], ["waldo"]]);
});

test("Test namespace get", () => {
    const obj = { "foo" : {"bar" : {"baz" : "qux"} } };
    const root = createRootEnv(obj, [["foo"]]);
    const child = root.newChild();

    expect(root.get("foo.bar")).toStrictEqual({"baz" : "qux"});
    expect(child.get("foo.bar")).toStrictEqual({"baz" : "qux"});
});

//test("Test namespace, readonly root, writable child, set simple value", () => {
//    const root = createRootEnv({"foo" : {"bar":"baz"}}, [["foo"]]);
//    const child = root.newChild();
//    expect(root.get("foo.bar")).toEqual("baz");
//    expect(child.get("foo.bar")).toEqual("baz");
//
//    child.set("foo.bar", "qux");
//    expect(root.get("foo.bar")).toEqual("baz");
//    expect(child.get("foo.bar")).toEqual("qux");
//});

//test("Test namespace, readonly root, and writable child, set object property", () => {
//    const root = createRootEnv({"foo" : {"bar":{"baz" : "qux"} } }, [["foo"]]);
//    const child = root.newChild();
//    expect(root.get("foo.bar.baz")).toEqual("qux");
//    expect(child.get("foo.bar.baz")).toEqual("qux");
//
//    child.set("foo.bar.baz", "corge");
//    expect(root.get("foo.bar.baz")).toEqual("qux");
//    expect(child.get("foo.bar.baz")).toEqual("corge");
//
//    expect(Reflect.ownKeys(child.properties["foo"])).not.toEqual(expect.arrayContaining([OVERRIDE]));
//    expect(Reflect.ownKeys(child.properties["foo"]["bar"])).toEqual(expect.arrayContaining([OVERRIDE]));
//});

test("Test find", () => {
    const root = createRootEnv({ "bar" : {"baz" : "qux"}, "corge" : {"baz" : "grault"} });
    const child = root.newChild();

    expect(root.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);
    expect(child.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);

    child.set("corge.baz", "qux");
    expect(root.findObjs(obj => obj["baz"] === "qux")).toHaveLength(2);
    expect(child.findObjs(obj => obj["baz"] === "qux")).toHaveLength(2);
})

test("Test find with namespace", () => {
    const root = createRootEnv({"namespace" : { "bar" : {"baz" : "qux"}, "corge" : {"baz" : "grault"} } }, [["namespace"]]);
    const child = root.newChild();

    expect(root.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);
    expect(child.findObjs(obj => obj["baz"] === "qux")).toHaveLength(1);

    child.set("namespace.corge.baz", "qux");
    expect(root.findObjs(obj => obj["baz"] === "qux")).toHaveLength(2);
    expect(child.findObjs(obj => obj["baz"] === "qux")).toHaveLength(2);
})

test("Test set simple property in namespace", () => {
    const root = createRootEnv({"namespace" : { "bar" : { "baz" : "qux"}}}, [["namespace"]]);
    const child = root.newChild();
    child.set("namespace.foo", "corge");

    expect(child.get("namespace.foo")).toStrictEqual("corge");
    expect(child.findObjs(_ => true)).toHaveLength(1);
});

test("Test overlapping namespaces", () => {
    const root = createRootEnv({
            "namespace1" : { 
                "bar" : { "baz" : "qux"},
                "namespace2" : { "corge" : "grault" }
            }
        }, [["namespace1"], ["namespace1","namespace2"]]);
    const child = root.newChild();

    expect(root.get("namespace1.bar")).toStrictEqual({ "baz" : "qux" });
    expect(root.get("namespace1.bar.baz")).toStrictEqual("qux");
    expect(root.get("namespace1.namespace2.corge")).toStrictEqual("grault");

    expect(child.get("namespace1.bar")).toStrictEqual({ "baz" : "qux" });
    expect(child.get("namespace1.bar.baz")).toStrictEqual("qux");
    expect(child.get("namespace1.namespace2.corge")).toStrictEqual("grault");

    child.set("namespace1.corge", { "foo" : "grault" } );
    expect(child.get("namespace1.corge")).toEqual({ "foo" : "grault"});

    const allObjs = child.findObjs(_ => true)
    expect(allObjs).toHaveLength(2);
    expect(allObjs).toEqual(expect.arrayContaining([{ "baz" : "qux"}, { "foo" : "grault" }]));

});

test("Limit search to namespace", () => {
    const root = createRootEnv({
        "namespace1" : { 
            "bar" : { "baz" : "qux"},
            "namespace2" : { 
                "bar" : { "baz" : "grault" }, 
                "foo" : { "baz" : "qux"}
            }
        },
        "namespace3" : {
            "corge" : { "baz" : "qux" }
        }
    }, [["namespace1"],["namespace1","namespace2"],["namespace3"]]);

    const child = root.newChild();

    const predicate = (obj : Obj) => obj["baz"] === "qux";

    expect(child.findObjs(predicate)).toHaveLength(3);
    expect(child.findObjs(predicate, [])).toHaveLength(0);
    expect(child.findObjs(predicate, [["namespace3"]])).toHaveLength(1);
    expect(child.findObjs(predicate, [["namespace1"]])).toHaveLength(1);
    expect(child.findObjs(predicate, [["namespace1","namespace2"]])).toHaveLength(1);
    expect(child.findObjs(predicate, [["namespace1"], ["namespace2"]])).toHaveLength(1); // ["namespace2"] does not exist
    expect(child.findObjs(predicate, [["namespace1"], ["namespace1", "namespace2"]])).toHaveLength(2);
    expect(child.findObjs(predicate, [["namespace3"], ["namespace1", "namespace2"]])).toHaveLength(2);
    expect(child.findObjs(predicate, [["namespace1"], ["namespace3"]])).toHaveLength(2);
    expect(child.findObjs(predicate, [["namespace1"], ["namespace3"]])).toHaveLength(2);
    expect(child.findObjs(predicate, [["namespace1"], ["namespace1", "namespace2"], ["namespace3"]])).toHaveLength(3);
})

test("Test reference to value", () => {
    const root = createRootEnv({
        "foo" : { "bar" : "baz"},
    });

    const child = root.newChild({"bar" : root.reference("foo.bar")});
    const result = child.get("bar");

    expect(result).toEqual("baz");

    child.set("bar", "qux");

    const childResultAfterSet = child.get("bar");

    expect(childResultAfterSet).toEqual("qux");
    
    const parentResultAfterSet = root.get("foo.bar");
    expect(parentResultAfterSet).toEqual("qux");
});

test("Test reference to object", () => {
    const root = createRootEnv({
        "foo" : { "bar" : { "baz" : "qux" }}
    });

    const child = root.newChild({"bar" : root.reference("foo.bar")});
    const result = child.get("bar.baz");
    expect(result).toEqual("qux");
})

test("Test reference to object (set)", () => {
    const root = createRootEnv({
        "foo" : { "bar" : { "baz" : "qux" }}
    });

    const child = root.newChild({"bar" : root.reference("foo.bar")});
    expect(child.get("bar.baz")).toEqual("qux");

    child.set("bar.baz", "corge");
    expect(child.get("bar.baz")).toEqual("corge");
    expect(root.get("foo.bar.baz")).toEqual("corge");
})

test("Test reference to namespace", () => {
    const root = createRootEnv({
        "namespace1" : { "foo" : "bar" }
    }, [["namespace1"]]);

    const child = root.newChild({ "ref" : root.reference("namespace1")});
    expect(child.get("ref.foo")).toEqual("bar");
});

test("Test references: different scope levels", () => {
    const root = createRootEnv({
        "entities" : {
            "foo" : { "bar" : "baz" },
            "qux" : { "bar" : "grualt" }
        },
        "verbs" : {
            "look" : { "intransitive" : true }
        }
    }, [["entities"], ["verbs"]]);

    const child1 = root.newChild();
    const child2 = child1.newChild(child1.createNamespaceReferences(["entities"]));
    const child3 = child2.newChild({ "this" : child2.reference("entities.foo")});

    expect(child3.get("this.bar")).toEqual("baz");
    expect(child3.get("foo.bar")).toEqual("baz");
    expect(child3.get("qux.bar")).toEqual("grualt");
    expect(child3.get("entities.foo.bar")).toEqual("baz");
    expect(child3.get("entities.qux.bar")).toEqual("grualt");
    expect(child3.get("verbs.look.intransitive")).toEqual(true);
});

test("Test references: different scope levels: test setting", () => {
    const root = createRootEnv({
        "entities" : {
            "foo" : { "bar" : "baz" },
            "qux" : { "bar" : "grault" }
        },
        "verbs" : {
            "look" : { "intransitive" : true }
        }
    }, [["entities"], ["verbs"]]);

    const child1 = root.newChild();
    const child2 = child1.newChild(child1.createNamespaceReferences(["entities"]));
    const child3 = child2.newChild({ "this" : child2.reference("entities.foo")});

    child3.set("this.bar", "xyzzy");
    child3.set("qux.bar",  "corge");

    expect(child3.get("this.bar")).toEqual("xyzzy");
    expect(child3.get("foo.bar")).toEqual("xyzzy");
    expect(child3.get("qux.bar")).toEqual("corge");
    expect(child3.get("entities.foo.bar")).toEqual("xyzzy");
    expect(child3.get("entities.qux.bar")).toEqual("corge");

    expect(child2.get("foo.bar")).toEqual("xyzzy");
    expect(child2.get("entities.foo.bar")).toEqual("xyzzy");
    expect(child2.get("entities.qux.bar")).toEqual("corge");

    expect(child1.get("entities.foo.bar")).toEqual("xyzzy");
    expect(child1.get("entities.qux.bar")).toEqual("corge");

    expect(root.get("entities.foo.bar")).toEqual("xyzzy");
    expect(root.get("entities.qux.bar")).toEqual("corge");
})

test("Test references to references", () => {
    const root = createRootEnv({
        "entities" : {
            "foo" : { "bar" : "baz" },
            "qux" : { "bar" : "grault" }
        },
        "verbs" : {
            "look" : { "intransitive" : true }
        }
    }, [["entities"], ["verbs"]]);

    const child1 = root.newChild();
    const child2 = child1.newChild({ "corge" : child1.reference("entities.foo") });
    const child3 = child2.newChild({ "xyzzy" : child2.reference("corge") });

    expect(child3.get("xyzzy.bar")).toEqual("baz");

    child3.set("xyzzy.qux", "garply");

    expect(child3.get("xyzzy.qux")).toEqual("garply");
    expect(child3.get("corge.qux")).toEqual("garply");
    expect(child3.get("entities.foo.qux")).toEqual("garply");

    expect(child2.get("corge.qux")).toEqual("garply");
    expect(child2.get("entities.foo.qux")).toEqual("garply");
    
    expect(child1.get("entities.foo.qux")).toEqual("garply");

    expect(isFound(root.get("entities.foo.qux"))).toBeTruthy();
});

function resultToValueList(result : [NameSpace, Path]) : [NameSpace, (string | symbol | number)[]] {
    const [ns, path] = result;
    return [ns, toValueList(path)];
}