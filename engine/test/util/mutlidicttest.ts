import * as multidict from "../../src/util/multidict";
import { MultiDict } from "../../src/util/multidict";

test("Test add", () => {
  const dict : MultiDict<string> = {};
  multidict.add(dict, "key1", "value1");

  expect(Object.values(dict)).toHaveLength(1);
  expect(Object.values(dict)).toEqual(expect.arrayContaining([["value1"]]));
});

test("Test add all", () => {
  const dict : MultiDict<string> = {};
  multidict.addAll(dict, "key1", ["value1", "value2"]);
  multidict.addAll(dict, "key2", ["foo", "bar"]);
  multidict.addAll(dict, "key1", ["value1", "value3"]);
  expect(Object.values(dict)).toHaveLength(2);
  expect(Object.values(dict)).toEqual(expect.arrayContaining([
    ["value1", "value2", "value1", "value3"],
    ["foo","bar"]
  ]))
});

test("Test add unique", () => {
  const dict : MultiDict<string> = {};
  multidict.addUnique(dict, "key1", ["value1", "value2"]);
  multidict.addUnique(dict, "key2", ["foo", "bar"]);
  multidict.addUnique(dict, "key1", ["value1", "value3"]);
  expect(Object.values(dict)).toHaveLength(2);
  expect(Object.values(dict)).toEqual(expect.arrayContaining([
    ["value1", "value2", "value3"],
    ["foo","bar"]
  ]))
})

test("Test get entries", () => {
    const dict : MultiDict<string> = {};
    multidict.addAll(dict, "key1", ["value1", "value2"]);
    multidict.addAll(dict, "key2", ["foo", "bar"]);
    const entries = multidict.entries(dict)
    expect(entries).toHaveLength(4);
    expect(entries).toEqual(expect.arrayContaining([
            ["key1", "value1"],
            ["key1", "value2"],
            ["key2", "foo"],
            ["key2", "bar"]]));
})

test("Test get values", () => {
  const dict : MultiDict<string> = {};
  multidict.addAll(dict, "key1", ["value1", "value2"]);
  multidict.addAll(dict, "key2", ["foo", "bar"]);
  const values = multidict.values(dict)
  expect(values).toHaveLength(4);
  expect(values).toEqual(expect.arrayContaining([ "value1", "value2", "foo", , "bar"]));
})