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
  expect(values).toEqual(expect.arrayContaining([ "value1", "value2", "foo", "bar"]));
})

test("Test filter", () => {
  const dict1 : MultiDict<number> = {};
  multidict.addAll(dict1, "key1", [1, 2, 3, 4]);
  multidict.addAll(dict1, "key2", [8, 7, 6, 5]);
  multidict.addAll(dict1, "key3", []);
  const dict2 = multidict.filter(dict1, (key, value) => value % 2 ==0);
  expect(multidict.get(dict2, "key1")).toEqual([2,4]);
  expect(multidict.get(dict2, "key2")).toEqual([8,6]);
  expect(multidict.get(dict2, "key3")).toEqual([]);
})

test("Test map", () => {
  const dict1 : MultiDict<number> = {};
  multidict.addAll(dict1, "key1", [1, 2, 3, 4]);
  multidict.addAll(dict1, "key2", [8, 7, 6, 5]);
  multidict.addAll(dict1, "key3", []);
  const dict2 = multidict.map(dict1, (key, value) => value + 1);
  expect(multidict.get(dict2, "key1")).toEqual([2, 3, 4, 5]);
  expect(multidict.get(dict2, "key2")).toEqual([9, 8, 7, 6]);
  expect(multidict.get(dict2, "key3")).toEqual([]);
})