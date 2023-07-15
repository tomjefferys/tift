import { Env } from "tift-types/src/env";
import { createRootEnv } from "../src/env";
import * as Properties from "../src/properties";

let env : Env;

beforeEach(() => {
    env = createRootEnv({});
});

test("simple set/get", () => {
    Properties.setProperty(env, "foo", "bar");
    expect(Properties.getProperty(env, "foo")).toBe("bar");
    expect(env.get("properties.foo")).toBe("bar");
});

test("simple set/get with overwrite", () => {
    Properties.setProperty(env, "foo", "bar");
    Properties.setProperty(env, "foo", "baz");
    expect(Properties.getProperty(env, "foo")).toBe("baz");
    expect(env.get("properties.foo")).toBe("baz");
});

test("object path set/get", () => {
    Properties.setProperty(env, "foo.bar", "baz");
    Properties.setProperty(env, "foo.qux.quux", "grault");
    Properties.setProperty(env, "foo.bar", "xyzzy");
    expect(Properties.getProperty(env, "foo.bar")).toBe("xyzzy");
    expect(Properties.getProperty(env, "foo.qux.quux")).toBe("grault");
    expect(Properties.getProperty(env, "foo")).toStrictEqual({"bar" : "xyzzy", "qux" : { "quux" : "grault" }});
    expect(env.get("properties.foo")).toStrictEqual({"bar" : "xyzzy", "qux" : { "quux" : "grault" }});
});

test("Test set object", () => {
    Properties.setProperty(env, "foo", { "bar" : "baz", "qux" : { "quux": "grault" }});
    expect(Properties.getProperty(env, "foo.bar")).toBe("baz");
    expect(Properties.getProperty(env, "foo.qux.quux")).toBe("grault");
    expect(env.get("properties.foo")).toStrictEqual({"bar" : "baz", "qux" : { "quux" : "grault" }});
})

test("Test setProperties", () => {
    Properties.setProperties(env, "foo", { "bar" : "baz", "qux" : { "quux": "grault" }});
    expect(Properties.getProperty(env, "foo.bar")).toBe("baz");
    expect(Properties.getProperty(env, "foo.qux.quux")).toBe("grault");
    expect(env.get("properties.foo")).toStrictEqual({"bar" : "baz", "qux" : { "quux" : "grault" }});
});

test("Test setProperties, selectively overwrite", () => {
    Properties.setProperties(env, "foo", { "bar" : "baz", "qux" : { "quux": "grault" }});
    Properties.setProperties(env, "foo", { "qux" : { "quux": "xyzzy", "one" : "two" }});
    console.log(JSON.stringify(env.properties));
    expect(Properties.getProperty(env, "foo.bar")).toBe("baz");
    expect(Properties.getProperty(env, "foo.qux.quux")).toBe("xyzzy");
    expect(Properties.getProperty(env, "foo.qux.one")).toBe("two");
});

test("Test setProperties, overwrite with path strings", () => {
    Properties.setProperties(env, "foo", { "bar" : "baz", "qux" : { "quux": "grault" }});
    Properties.setProperties(env, "", { "foo.qux.quux" : "xyzzy", "foo.qux.one" : "two" });
    expect(Properties.getProperty(env, "foo.bar")).toBe("baz");
    expect(Properties.getProperty(env, "foo.qux.quux")).toBe("xyzzy");
    expect(Properties.getProperty(env, "foo.qux.one")).toBe("two");
});
