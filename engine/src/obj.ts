import {Obj, ObjValue, ObjArray} from "./types"

export function getString(value : ObjValue) : string {
    if (typeof value != 'string') {
      throw new Error(JSON.stringify(value) + " is not a string"); 
    }
    return value;
  }
  
export function getArray(value : ObjValue) : ObjArray {
  if (!Array.isArray(value)) {
    throw new Error(JSON.stringify(value) + " is not an array");
  }
  return value;
}

export function getObj(value : ObjValue) : Obj {
  if (!isObject(value)) {
      throw new Error(JSON.stringify(value) + " is not an object");
  }
  return value as Obj;
}

export function forEach(value : ObjValue, fn : (value:ObjValue) => void) {
  if (value && Array.isArray(value)) {
    value.forEach(fn);
  }
}

export function forEachEntry(value : ObjValue, fn : (key : string, value: ObjValue) => void) {
  if (value && isObject(value)) {
    Object.entries(value)
          .forEach(entry => fn(entry[0], entry[1]));
  }
}

export function ifExists(value : ObjValue, fn : (value:ObjValue) => void) {
  if (value) {
    fn(value);
  }
}

function isObject(value : ObjValue) : boolean {
  return (!Array.isArray(value) && value !== null && typeof value === 'object');
}
  