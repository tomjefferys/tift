import { this_str } from "jsep";
import { match, capture, getMatcher, MatchResultSuccess } from "../src/actionmatcher"

test("test empty input", () => {
    const matcher = getMatcher([match("one"), match("two"), match("three")]);
    const result = matcher([""]);
    expect(result.match).toBe(false);
})

test("test empty match", () => {
    const matcher = getMatcher([]);
    let result = matcher(["one", "two", "three"]);
    expect(result.match).toBe(false);

    result = matcher([]);
    expect(result.match).toBe(true);
    expect((result as MatchResultSuccess).bindings).toStrictEqual({});
})

test("test simple match", () => {
    const matcher = getMatcher([match("one"), match("two"), match("three")]);
    const result = matcher(["one", "two", "three"]);
    expect(result.match).toBe(true);
    const success = result as MatchResultSuccess;
    expect(success.bindings).toStrictEqual({});
})

test("test simple capture", () => {
    const matcher = getMatcher([match("one"), capture("number"), match("three")]);
    const result = matcher(["one", "two", "three"]);
    expect(result.match).toBe(true);
    const success = result as MatchResultSuccess;
    expect(success.bindings).toStrictEqual({"number": "two"});
})