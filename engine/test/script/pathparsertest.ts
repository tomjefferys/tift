import { toValueList } from "../../src/path";
import { parsePath } from "../../src/script/pathparser"

test("Test empty path", () => {
    const path = parsePath("");
    expect(path).toEqual([]);
})

test("Test single indentifer", () => {
    const path = parsePath("foo");
    expect(toValueList(path)).toEqual(["foo"]);
})

test("Test object path", () => {
    const path = parsePath("foo.bar");
    expect(toValueList(path)).toEqual(["foo", "bar"]);
})

test("Test nested object path", () => {
    const path = parsePath("foo.bar.baz");
    expect(toValueList(path)).toEqual(["foo", "bar", "baz"]);
})

test("Test array access", () => {
    const path = parsePath("foo[10]");
    expect(toValueList(path)).toEqual(["foo", 10]);
})

test("Test combined array object access", () => {
    const path = parsePath("foo.bar[10]");
    expect(toValueList(path)).toEqual(["foo", "bar", 10]);

    const path2 = parsePath("foo[10].bar");
    expect(toValueList(path2)).toEqual(["foo", 10, "bar"]);
})

test("Test double array access", () => {
    const path = parsePath("foo.bar[1][2]");
    expect(toValueList(path)).toEqual(["foo", "bar", 1, 2]);
})
