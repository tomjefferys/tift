import * as _ from "lodash"
import { Path, PathElement, pathElementEquals, fromValueList } from "./path";
import { parsePath } from "./script/pathparser";
import { Optional } from "./util/optional";

export const OVERRIDE = Symbol("__override__");

export type ReadOnly = "readonly" | "writable";


/* eslint-disable @typescript-eslint/no-explicit-any */
export type Obj = {[key:string | symbol]:any};
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
    set(name : Path | string | symbol, value : any) {
        const setPath = (_.isString(name) || _.isSymbol(name))? parsePath(name) : name;
        if (!this.writable) {
            throw new Error("Can't set variable on readonly env");
        }
        const [ns, path] = this.matchNameSpace(setPath);
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

    setToNameSpace(ns : NameSpace, path : Path, value : any) {
        const [head,tail] = splitPath(path);
        const [env, isOverride] = this.findWritableEnv(ns, head) ?? [this, false];
        const nsObj = env.getNameSpace(ns, true); 
        if (nsObj === undefined) {
            throw new Error("Could not get namespace: " + ns);
        }
        const headValue = head.getValue();
        if (!tail) {
            nsObj[headValue] = value;
            return;
        }
        const obj = nsObj[headValue] ?? {};
        if (typeof obj !== "object") {
            throw new Error(headValue.toString() + " is not an object");
        }
        if (isOverride) {
            obj[OVERRIDE] = true;
        }
        if (!nsObj[headValue]) {
            nsObj[headValue] = obj;
        }
        setToObj(obj, tail, value);
    }

    /**
     * Get a variable. Will search parent environments, as well as this one.
     * @param name 
     * @returns 
     */
    get(name : Path | string | symbol) : any {
        const getPath = (_.isString(name) || _.isSymbol(name))? parsePath(name) : name;
        const [ns, path] = this.matchNameSpace(getPath);
        return this.getFromNameSpace(ns, path);
    }

    getFromNameSpace(ns : NameSpace, path : Path) {
        if (!path || (_.isArray(path) && !path.length)) {
            throw new Error("Can't get empty path from namespace: " + ns);
        }

        const [head,tail] = splitPath(path);
        const env = this.findEnv(ns, head);

        if (!env) {
            throw new Error("No such varible " + _.flattenDeep([...ns, path.map(e => e.getValue().toString())]).join(".").toString());
        }

        const value = _.get(env.properties, [...ns, head.getValue()]);
        return (typeof value === "object")
            ? env.getObjProperty(ns, head, tail)
            : value;
    }

    has(name : Path | string | symbol) : boolean {
        const getPath = (_.isString(name) || _.isSymbol(name))? parsePath(name) : name;
        const [ns, path] = this.matchNameSpace(getPath);

        const [head,_tail] = splitPath(path);
        const env = this.findEnv(ns, head);
        return Boolean(env);
    }

    /**
     * Get a variable as a string
     * @param name 
     * @returns 
     */
    getStr(name : string) : string {
        const path = parsePath(name);
        return this.get(path).toString();
    }

    getArr(name : string) : AnyArray {
        const path = parsePath(name);
        const arr = this.get(path);
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
    private getObjProperty(ns : NameSpace, head : PathElement, tail : Path | undefined) : any {
        const value = _.get(this.properties, [...ns, head.getValue()]);

        if (typeof value !== "object") {
            throw new Error(head.toString() + " is not an object");
        }

        let obj;
        if (value[OVERRIDE] && this.parent) {
            obj = this.parent?.getFromNameSpace(ns, [head]);
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
    private findEnv(ns : NameSpace, name : PathElement) : Optional<Env> {
        return _.has(this.properties,[...ns, name.getValue()])
                ? this
                : this.parent?.findEnv(ns, name);
    }

    /**
     * Check if an environment, or one of it's ancestors has a property
     * @param name the name of the property
     * @returns true if the property exists
     */
    private hasProperty(ns : NameSpace, name : PathElement) : boolean {
        return _.has(this.properties,[...ns, name.getValue()])
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
    private findWritableEnv(ns : NameSpace, name : PathElement) : [Env,boolean] | undefined {
        let result : [Env,boolean] | undefined = undefined;
        if (_.has(this.properties, [...ns, name.getValue()]) && this.writable) {
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
        const fn = this.get(parsePath(name));
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

    isNameSpace(path : Path) : boolean {
        return !!this.getNamespaces().find(ns => pathsEqual(path, fromValueList(ns)));
    }

    /**
     * @returns the names of all object in this (and parent) envs
     */
    getAllObjectNames(namespaces : NameSpace[]) : Path[] {
        const objNames = this.parent?.getAllObjectNames(namespaces) ?? [];
        namespaces.flatMap(ns => this.getObjectNamesFromNameSpace(ns))
                  .filter(path => !objNames.find(p => pathsEqual(p,path)))
                  .forEach(path => objNames.push(path));
        return objNames;
    }

    /**
     * @returns all objects for the specified namespace
     */
    getObjectNamesFromNameSpace(ns : NameSpace) : Path[] {
        const nsObj = this.getNameSpace(ns) ?? {};
        return Object.entries(nsObj)
                     .filter(([_key, value]) => _.isObject(value))
                     .map(([key, _value]) => fromValueList([...ns, key]))
                     .filter(path => !this.isNameSpace(path));
    }

    /**
     * Find all objects matching a predicate
     * @param predicate 
     * @returns 
     */
    findObjs(predicate: (obj: Obj) => boolean, namespaces : NameSpace[] = this.getNamespaces()) : Obj[] {
        const allNames = [...this.getAllObjectNames(namespaces)];
        return allNames.map(name => this.get(name))
                       .filter(predicate);
    }

    matchNameSpace(path : Path | string) : [NameSpace, Path] {
        const nsPath = _.isString(path)? parsePath(path) : path;
        let longestMatch : Optional<[NameSpace, Path]> = undefined;
        for(const ns of this.getNamespaces()) {
            // FIXME there's a type mismatch here, looks like nsPath is maybe the wrong type
            const [match, tail] = hasPrefix(nsPath, fromValueList(ns));
            if (match && (longestMatch === undefined || ns.length > longestMatch[0].length)) {
                longestMatch = [ns, tail];
            }
        }
        return longestMatch ?? [[], nsPath];
    }
}

/**
 * Access a value inside an object, referenced using dot syntax
 * @param obj 
 * @param name 
 */
function getFromObj(obj : Obj, path : Path) : any {
    const [head, tail] = splitPath(path);
    const value = obj[head.getValue()];
    if (!value) {
        throw new Error("Variable " + head.getValue().toString() + " does not exist");
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
function setToObj(obj : Obj, name : Path, value : any) {
    const [head,tail] = splitPath(name);
    if (!tail) {
        obj[head.getValue()] = value;
        return;
    }
    const child = obj[head.getValue()] ?? {};
    if (!obj[head.getValue()]) {
        obj[head.getValue()] = child;
    }
    if (typeof child !== "object") {
        throw new Error(head.toString() + " is not an object");
    } 
    setToObj(child, tail, value);
}

/**
 * Split a path, into it's head and tail
 * @param name
 * @returns 
 */
function splitPath(path : Path) : [PathElement, Path | undefined] {
    if (typeof path === "symbol") {
        return [path, undefined];
    } else {
        const head = path[0];
        const tail = (path.length > 1)? path.slice(1) : undefined;
        return [head, tail];
    }
}

function hasPrefix(path? : Path, prefix? : Path) : [boolean, Path] {
    if (!prefix) { 
        // No prefix left, it's match.
        return [true, path ?? []];
    }
    if (!path) {
        // No path left, but still have prefix.  No match.
        return [false, []];
    }
    const [pathHead, pathTail] = splitPath(path);
    const [prefixHead, prefixTail] = splitPath(prefix);
    return pathElementEquals(pathHead, prefixHead)? hasPrefix(pathTail, prefixTail) : [false, []];
}

function pathsEqual(path1? : Path, path2? : Path) : boolean {
    if (!path1 || !path2) {
        return path1 === path2;
    }
    const [head1, tail1] = splitPath(path1);
    const [head2, tail2] = splitPath(path2);
return (pathElementEquals(head1, head2))? pathsEqual(tail1, tail2) : false;
}

/** 
 * Create a new root environment, based on the supplied object
 */
export function createRootEnv(obj : Obj, readonly : ReadOnly = "writable", namespaces : NameSpace[] = []) : Env {
    return new Env(readonly == "writable", obj, [[], ...namespaces]);
}