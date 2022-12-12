import * as Objects from "../../src/util/objects"

test("Test set, no nesting", () => {
    const obj = { "foo" : "bar", "baz" : "qux" };
    Objects.set(obj, ["baz"], "grault");

    expect(obj).toStrictEqual({ "foo" : "bar", "baz" : "grault" });
});

test("Test set, with nesting", () => {
    const obj = { "foo" : "bar", "baz" : { "qux" : "quux" } };
    Objects.set(obj, ["baz", "qux"], "xyzzy");

    expect(obj).toStrictEqual({ "foo" : "bar", "baz" : { "qux" : "xyzzy" } });
});

test("Test set, create path", () => {
    const obj = { "foo" : "bar" };
    Objects.set(obj, ["baz", "qux"], "xyzzy");

    expect(obj).toStrictEqual({ "foo" : "bar", "baz" : { "qux" : "xyzzy" } });
});

test("Test unset, no nesting", () => {
    const obj = { "foo" : "bar", "baz" : "qux" };
    Objects.unset(obj, ["baz"]);

    expect(obj).toStrictEqual({ "foo" : "bar" });
});

test("Test unset, with nesting", () => {
    const obj = { "foo" : "bar", "baz" : { "qux" : "quux" } };
    Objects.unset(obj, ["baz", "qux"]);

    expect(obj).toStrictEqual({ "foo" : "bar", "baz" : { } });
})