export type PropType = string | symbol;
export type Obj = {[key:PropType]:unknown};

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
 * @returns true if value is object like (ie an object or an array)
 */
export function isObject(value : unknown) : value is Obj {
    return typeof value === 'object' && value !== null
}

function splitPath(path : PropType[]) : [PropType, PropType[]] {
    return [path[0], path.slice(1)];
}