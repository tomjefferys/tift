import * as _ from "lodash"
import { ifPresent, Optional } from "./util/optional";


export const OVERRIDE = Symbol("__override__");

export type ReadOnly = "readonly" | "writable";

export type ObjKey = string | symbol;

// Either an ObjKey, or an array of ObjKeys with at least one element
export type ObjPath = ObjKey | ObjKey[];

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Obj = {[key:ObjKey]:any};
/* eslint-disable @typescript-eslint/no-explicit-any */

export type AnyArray = unknown[];

export type EnvFn = (env:Env) => ReturnType;

export type ReturnType = boolean | number | string | EnvFn | Obj | AnyArray | void;

export type NameSpace = string[];

// An execution envionment for a function.  Contains all local variables, and access to 
// variables in parent environments
export class Env {
    readonly parent? : Env;
    readonly properties : Obj;
    readonly writable : boolean;
    readonly namespaces : NameSpace[];

    constructor(writable : boolean, properties : Obj, namespaces : NameSpace[] = [], parent? : Env) {
        this.parent = parent;
        this.writable = writable;
        this.properties = properties;
        this.namespaces = namespaces;
    }

    /**
     * Declare variable in this environment.  Don't look for previous definitions in parent envs
     * Declaration will shadow any variables in wider scopes
     * @param name 
     * @param value 
     */
    def(name : string, value : any) {
        this.properties[name] = value;
    }

    /**
     * Set a variable, either in this environment, or in a parent environment if it already
     * exists there
     * @param name 
     * @param value 
     */
    // TODO need syntax for accessing arrays
    set(name : ObjPath, value : any) {
        if (!this.writable) {
            throw new Error("Can't set variable on readonly env");
        }
        const [ns, path] = this.matchNameSpace(name);
        this.setToNameSpace(ns, path, value);
    }

    /**
     * @param ns a namespace to look for
     * @returns the namespace object, creating one if it doesn't exist
     */
    getNameSpace(ns : NameSpace, create = false) : Optional<Obj> {
        let obj = this.properties;
        for(const part of ns) {
            if (!obj[part] && create) {
                obj[part] = {};
            }
            obj = obj[part];
            if (obj === undefined) {
                break;
            }
        }
        return obj;
    }

    setToNameSpace(ns : NameSpace, path : ObjPath, value : any) {
        const [head,tail] = dotSplit(path);
        const [env, isOverride] = this.findWritableEnv(ns, head) ?? [this, false];
        const nsObj = env.getNameSpace(ns, true); 
        if (nsObj === undefined) {
            throw new Error("Could not get namespace: " + ns);
        }
        if (!tail) {
            nsObj[head] = value;
            return;
        }
        const obj = nsObj[head] ?? {};
        if (typeof obj !== "object") {
            throw new Error(head.toString() + " is not an object");
        }
        if (isOverride) {
            obj[OVERRIDE] = true;
        }
        if (!nsObj[head]) {
            nsObj[head] = obj;
        }
        setToObj(obj, tail, value);
    }

    /**
     * Get a variable. Will search parent environments, as well as this one.
     * @param name 
     * @returns 
     */
    get(name : ObjPath) : any {
        const [ns, path] = this.matchNameSpace(name);
        return this.getFromNameSpace(ns, path);
    }

    getFromNameSpace(ns : NameSpace, path : ObjPath) {
        if (!path || (_.isArray(path) && !path.length)) {
            throw new Error("Can't get empty path from namespace: " + ns);
        }

        const [head,tail] = dotSplit(path);
        const env = this.findEnv(ns, head);

        if (!env) {
            throw new Error("No such varible " + _.flattenDeep([...ns, path]).join(".").toString());
        }

        const value = _.get(env.properties, [...ns, head]);
        return (typeof value === "object")
            ? env.getObjProperty(ns, head, tail)
            : value;
    }

    /**
     * Get a variable as a string
     * @param name 
     * @returns 
     */
    getStr(name : string) : string {
        return this.get(name).toString();
    }

    getArr(name : string) : AnyArray {
        const arr = this.get(name);
        if (!Array.isArray(arr)) {
            throw new Error(name + " is not an array");
        }
        return arr;
    }

    getNamespaces() : NameSpace[] {
        const parentNamespaces = this.parent?.getNamespaces() ?? []
        return [...this.namespaces, ...parentNamespaces];
    }

    /**
     * Look for a property inside an object.  Used where dot syntax has been used to access a varaible,
     * eg get("foo.bar.baz")
     * @param head 
     * @param tail 
     */
    private getObjProperty(ns : NameSpace, head : ObjKey, tail : ObjPath | undefined) : any {
        const value = _.get(this.properties, [...ns, head]);

        if (typeof value !== "object") {
            throw new Error(head.toString() + " is not an object");
        }

        let obj;
        if (value[OVERRIDE] && this.parent) {
            obj = this.parent?.getFromNameSpace(ns, head);
            _.merge(obj, value);
            delete obj[OVERRIDE];
            removeNulls(obj);
        } else {
            obj = value;
        }

        const result = tail? getFromObj(obj, tail) : obj;
        return _.cloneDeep(result);
    }

    /**
     * Find an environment containing a property
     * @param name the name of the property
     * @returns the matching environment
     */
    private findEnv(ns : NameSpace, name : ObjKey) : Optional<Env> {
        return _.has(this.properties,[...ns, name])
                ? this
                : this.parent?.findEnv(ns, name);
    }

    /**
     * Check if an environment, or one of it's ancestors has a property
     * @param name the name of the property
     * @returns true if the property exists
     */
    private hasProperty(ns : NameSpace, name : ObjKey) : boolean {
        return _.has(this.properties,[...ns, name])
                    ? true
                    : this.parent?.hasProperty(ns, name) ?? false;
    }

    /**
     * Find a writable env that could contain a property
     * Returns either the one containing the property, or if that one is 
     *   readonly the closest writable descendent, in which case we are 
     *   considering it an override
     * @param name 
     * @returns A tuple of the writable env, and an boolean indicating if 
     *          this is an override
     */
    private findWritableEnv(ns : NameSpace, name : ObjKey) : [Env,boolean] | undefined {
        let result : [Env,boolean] | undefined = undefined;
        if (_.has(this.properties, [...ns, name]) && this.writable) {
            result = [this,false];
        } else if (this.parent) {
            if (this.parent.writable) {
                result = this.parent.findWritableEnv(ns, name);
            } else if (this.parent.hasProperty(ns, name)) {
                result = [this, true];
            }
        }
        return result;
    }

    /**
     * execute a function and return the result
     * @param name the name of the function
     * @param bindings parameter binding
     * @returns the result of the function
     */
    execute(name : string, bindings : Obj ) : ReturnType {
        const fn = this.get(name);
        return this.executeFn(fn, bindings);
    }

    executeFn(fn : EnvFn, bindings : Obj) : ReturnType {
        const fnEnv = this.newChild();
        fnEnv.addBindings(bindings);
        return fn(fnEnv);
    }

    /**
     * @returns a new child environment of the current environment
     */
    newChild(obj : Obj = {}) : Env {
        return new Env(true, obj, [], this); 
    }

    addBindings(bindings : Obj) {
        for(const [key, value] of Object.entries(bindings)) {
            this.properties[key] = value;
        }
    }

    getRoot() : Env {
        return (this.parent)? this.parent.getRoot() : this;
    }

    getDepth() : number {
        return 1 + (this.parent?.getDepth() ?? 0);
    }

    isNameSpace(path : ObjPath) : boolean {
        return !!this.getNamespaces().find(ns => pathsEqual(path, ns));
    }

    /**
     * @returns the names of all object in this (and parent) envs
     */
    // TODO, this is really ugly, tidy up!
    getAllObjectNames() : ObjPath[] {
        const objNames = this.parent?.getAllObjectNames() ?? [];
        for(const ns of this.getNamespaces()) {
            const nsObj = this.getNameSpace(ns);
            ifPresent(nsObj, obj => {
                for(const [name,value] of Object.entries(obj)) {
                    if (_.isObject(value)) {
                        const path = [...ns, name];
                        if (!this.isNameSpace(path) && !objNames.find(p => pathsEqual(p, path))) {
                            objNames.push(path);
                        }
                    }
                }
            })
        }
        return objNames;
    }

    /**
     * Find all objects matching a predicate
     * @param predicate 
     * @returns 
     */
    findObjs(predicate: (obj: Obj) => boolean) : Obj[] {
        const allNames = [...this.getAllObjectNames()];
        return allNames.map(name => this.get(name))
                       .filter(predicate);
    }

    matchNameSpace(path : ObjPath) : [NameSpace, ObjPath] {
        let longestMatch : Optional<[NameSpace, ObjPath]> = undefined;
        for(const ns of this.getNamespaces()) {
            const [match, tail] = hasPrefix(path, ns);
            if (match && (longestMatch === undefined || ns.length > longestMatch[0].length)) {
                longestMatch = [ns, tail];
            }
        }
        return longestMatch ?? [[], path];
    }
}

/**
 * Access a value inside an object, referenced using dot syntax
 * @param obj 
 * @param name 
 */
function getFromObj(obj : Obj, path : ObjPath) : any {
    const [head, tail] = dotSplit(path);
    const value = obj[head];
    if (!value) {
        throw new Error("Variable " + head.toString() + " does not exist");
    }
    if (!tail) {
        return value;
    } else {
        if (typeof value === "object") {
            return getFromObj(value, tail);
        } else {
            throw new Error(head.toString() + " is not an object");
        }
    }
}

function removeNulls(obj : Obj) {
    for(const [key, value] of Object.entries(obj)) {
        if (value === null) {
            delete obj[key];
        } else if (_.isObject(value)) {
            removeNulls(value);
        }
    }
}

/**
 * Set a value inside an object, referenced using dot syntax
 * @param obj 
 * @param name 
 */
function setToObj(obj : Obj, name : ObjPath, value : any) {
    const [head,tail] = dotSplit(name);
    if (!tail) {
        obj[head] = value;
        return;
    }
    const child = obj[head] ?? {};
    if (!obj[head]) {
        obj[head] = child;
    }
    if (typeof child !== "object") {
        throw new Error(head.toString() + " is not an object");
    } 
    setToObj(child, tail, value);
}

/**
 * Split a string on the first dot, eg "foo.bar.baz" -> ["foo","bar.baz"]
 * @param name
 * @returns 
 */
function dotSplit(path : ObjPath) : [ObjKey, ObjPath | undefined] {
    if (typeof path === "symbol") {
        return [path, undefined];
    } else {
        const components = (_.isString(path))? path.split(".") : path;
        const head = components[0];
        const tail = (components.length > 1)? components.slice(1) : undefined;
        return [head, tail];
    }
}

function hasPrefix(path? : ObjPath, prefix? : ObjPath) : [boolean, ObjPath] {
    if (!prefix) { 
        // No prefix left, it's match.
        return [true, path ?? []];
    }
    if (!path) {
        // No path left, but still have prefix.  No match.
        return [false, []];
    }
    const [pathHead, pathTail] = dotSplit(path);
    const [prefixHead, prefixTail] = dotSplit(prefix);
    return pathHead === prefixHead? hasPrefix(pathTail, prefixTail) : [false, []];
}

function pathsEqual(path1? : ObjPath, path2? : ObjPath) : boolean {
    if (!path1 || !path2) {
        return path1 === path2;
    }
    const [head1, tail1] = dotSplit(path1);
    const [head2, tail2] = dotSplit(path2);
    return (head1 === head2)? pathsEqual(tail1, tail2) : false;
}

/** 
 * Create a new root environment, based on the supplied object
 */
export function createRootEnv(obj : Obj, readonly : ReadOnly = "writable", namespaces : NameSpace[] = []) : Env {
    return new Env(readonly == "writable", obj, [[], ...namespaces]);
}