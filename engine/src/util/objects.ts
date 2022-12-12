
export type PropType = string | symbol;

export type Obj = {[key:PropType]:any};

/**
 * Set an object property using the supplied path.
 * (Used instead of lodash by the historyproxy, as lodash makes a set call on the grandparent in the path)
 * @param obj 
 * @param path 
 * @param newValue 
 */
export function set(obj : Obj, path : PropType[], newValue : any) : any {
    if (path.length == 0) {
        throw new Error("Cannot set an empty path");
    }
    const [head, tail] = splitPath(path);
    let oldValue : any;
    if (tail.length) {
        if (!obj[head]) {
            obj[head] = {};
        }
        oldValue = set(obj[head], tail, newValue);
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
export function unset(obj : Obj, path : PropType[]) : any {
    if (path.length == 0) {
        throw new Error("Cannot unset an empty path");
    }
    const [head, tail] = splitPath(path);
    let oldValue = undefined;
    if (obj[head]) {
        if (tail.length) {
            oldValue = unset(obj[head], tail);
        } else {
            oldValue = obj[head];
            delete obj[head];
        }
    }
    return oldValue;
}

function splitPath(path : PropType[]) : [PropType, PropType[]] {
    return [path[0], path.slice(1)];
}