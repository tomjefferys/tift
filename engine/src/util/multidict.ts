import _ from "lodash";

export type KeyType = string;
export type MultiDict<T> = {[key:KeyType]: T[]};

function getOrInitialize<T>(dict : MultiDict<T>, key : KeyType) {
  let arr = dict[key];
  if (!arr) {
    arr = [];
    dict[key] = arr;
  }
  return arr;
}

export function add<T>(dict : MultiDict<T>, key : KeyType, value : T) {
  getOrInitialize(dict, key).push(value);
  return dict;
}

export function addAll<T>(dict : MultiDict<T>, key : KeyType, values : T[]) {
  getOrInitialize(dict, key).push(...values);
  return dict;
}

export function addUnique<T>(dict : MultiDict<T>, key : KeyType, values : T[]) {
  const arr = getOrInitialize(dict, key);
  arr.push(...values.filter(v => !arr.includes(v)));
  return dict;
}

export function get<T>(dict : MultiDict<T>, key : KeyType) : T[] {
  const arr = dict[key];
  return arr ? arr : [];
}

export function remove<T>(dict : MultiDict<T>, key : KeyType, value : T) {
  const arr = dict[key];
  if (arr) {
    const index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
  }
}

function entryToEntries<T>(entry : [KeyType, T[]]) : [KeyType, T][] {
  const [key, values] = entry;
  return values.map(value => [key, value])
}

export function entries<T>(dict : MultiDict<T>) : [KeyType,T][] {
  return Object.entries(dict).flatMap(entryToEntries);
}

export function values<T>(dict : MultiDict<T>) : T[] {
  return Object.entries(dict).flatMap(entry => entry[1]);
}
