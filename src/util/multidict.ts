
export type KeyType = string | symbol;
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