import _ from "lodash";

export type PropType = string | symbol;

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Obj = {[key:PropType]:any};

export const KIND = "__kind__";

/**
 * Set an object property using the supplied path.
 * (Used instead of lodash by the historyproxy, as lodash makes a set call on the grandparent in the path)
 * @param obj 
 * @param path 
 * @param newValue 
 */
export function set(obj : Obj, path : PropType[], newValue : unknown) : unknown {
    if (path.length == 0) {
        throw new Error("Cannot set an empty path");
    }
    const [head, tail] = splitPath(path);
    let oldValue : unknown;
    if (tail.length) {
        if (!obj[head]) {
            obj[head] = {};
        }
        const child = obj[head];
        if (isObject(child)) {
            oldValue = set(child, tail, newValue);
        } else {
            throw new Error("Can't set " + [head, ...tail].join(".") + " " + head.toString() + " is not an object");
        }
    } else {
        oldValue = obj[head];
        obj[head] = newValue;
    }
    return oldValue;
}

/**
 * Set an object property using the supplied path.
 * @param obj 
 * @param path 
 * @param newValue 
 */
export function unset(obj : Obj, path : PropType[]) : unknown {
    if (path.length == 0) {
        throw new Error("Cannot unset an empty path");
    }
    const [head, tail] = splitPath(path);
    let oldValue = undefined;
    if (obj[head]) {
        if (tail.length) {
            const child = obj[head];
            if (isObject(child)) {
                oldValue = unset(child, tail);
            } else {
                throw new Error("Can't unset " + [head, ...tail].join(".") + " " + head.toString() + " is not an object");
            }
        } else {
            oldValue = obj[head];
            delete obj[head];
        }
    }
    return oldValue;
}

/**
 * @param value 
 * @returns true if value is object like (ie an object, array, or function)
 */
export function isObject(value : unknown) : value is Obj {
    return (typeof value === 'object' || typeof value === 'function') && value !== null
}


export function getString(value : unknown) : string {
    if (typeof value != 'string') {
      throw new Error(JSON.stringify(value) + " is not a string"); 
    }
    return value;
  }
  
export function getArray(value : unknown) : unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(JSON.stringify(value) + " is not an array");
  }
  return value;
}

export function getObj(value : unknown) : Obj {
  if (!isObject(value)) {
      throw new Error(JSON.stringify(value) + " is not an object");
  }
  return value as Obj;
}

export function forEach(value : unknown, fn : (value : unknown, index : number) => void) {
  if (value && Array.isArray(value)) {
    value.forEach(fn);
  }
}

export function forEachEntry(value : unknown, fn : (key : string, value: unknown) => void) {
  if (value && isObject(value)) {
    Object.entries(value)
          .forEach(entry => fn(entry[0], entry[1]));
  }
}

export function ifExists<T>(value : T, fn : (value:T) => void) {
  if (value) {
    fn(value);
  }
}

export function isEmptyObject(value : unknown) : boolean {
  return _.isObject(value) && !_.isArray(value) && _.isEmpty(value);
}

export function getType(value : unknown) : string {
  return Object.prototype.toString.call(value);
}

function splitPath(path : PropType[]) : [PropType, PropType[]] {
    return [path[0], path.slice(1)];
}

/**
 * Adds a label parameter to the object, which can be used when debugging
 * @param obj 
 * @param label 
 * @returns 
 */
export function label<T>(obj : T, label : string) : T {
  return Object.assign(obj, {label})
}
