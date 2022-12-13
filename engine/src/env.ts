
/**
 * Implenent exection environment using a history proxy to keep track of changes
 */

import _ from "lodash"
import { Path, PathElement, pathElementEquals, fromValueList, makePath, toValueList } from "./path";
import { parsePath } from "./script/pathparser";
import { Action, ProxyManager } from "./util/historyproxy";
import { Optional } from "./util/optional";

export const REFERENCE = Symbol("__reference__");
export const NAMESPACE = Symbol("__namespace__");
export const NOT_FOUND = Symbol("__notfound__");

export type ReadOnly = "readonly" | "writable";


/* eslint-disable @typescript-eslint/no-explicit-any */
export type Obj = {[key:string | symbol]:any};

export type AnyArray = unknown[];

export type EnvFn = (env:Env) => ReturnType;

export type ReturnType = boolean | number | string | EnvFn | Obj | AnyArray | void;

export type NameSpace = string[];

// An execution envionment for a function.  Contains all local variables, and access to 
// variables in parent environments
export class Env {
    readonly parent? : Env;
    readonly properties : Obj;
    readonly namespaces : NameSpace[];
    readonly proxyManager : ProxyManager;

    constructor(properties : Obj, namespaces : NameSpace[] = [], parent? : Env) {
        this.proxyManager = new ProxyManager();
        this.parent = parent;
        this.properties = this.proxyManager.createProxy(properties);
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
    set(name : Path | string | symbol, value : any) : void {
        let setPath = (_.isString(name) || _.isSymbol(name))? parsePath(name) : name;

        setPath = this.expandReferences(setPath);

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
        const env = this.findEnv(ns, head) ?? this;
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
    get(name : Path | string | symbol, followReferences = true) : any {
        let getPath = (_.isString(name) || _.isSymbol(name))? parsePath(name) : name;

        if (followReferences) {
            getPath = this.expandReferences(getPath);
        }
        const [ns, path] = this.matchNameSpace(getPath);
        return this.getFromNameSpace(ns, path);
    }

    expandReferences(path : Path, expandedPath : Path = []) : Path {
        const [head, tail] = splitPath(path);
        const [newPath, found] = this.followReferences([...expandedPath, head]);
        if (!found) {
            return [...newPath, ...(tail ?? [])];
        } else {
            return (tail && tail.length)? this.expandReferences(tail, newPath) : newPath;       
        }
    }

    followReferences(path : Path, visited : Path[] = []) : [Path, boolean]{
        let result = path;
        let target = this.get(path, false);
        if (isReference(target)) {
            const newPath = target[REFERENCE];
            if (visited.includes(newPath)) {
                throw new Error("Loop detecected following references: " + JSON.stringify(visited.map(p => toValueList(p))));
            }
            [result, target] = this.followReferences(newPath, [...visited, path]);
        }
        return [result, isFound(target)];
    }

    /**
     * Creates a proxy object that contains references to all objects in a namespace
     * @param ns 
     */
    createNamespaceReferences(ns : NameSpace) {
        const handler = {
            getOwnPropertyDescriptor : (target : any, property : any) => {
                const value = handler.get(target, property);
                return isFound(value) ? { configurable : true, enumerable : true, value } : undefined;
            },
            // If the requested object exist in the nameaspace, return a reference to it
            get : (_target : any, key : any) => {
                return (this.has(makePath([...ns, key]))) 
                        ? this.reference(makePath([...ns, key])) 
                        : notFound(makePath([key]));
            },
            has : (_target : any, key : any) => {
                return this.has([...ns, key]);
            }
        }
        return new Proxy({}, handler);
    }

    getFromNameSpace(ns : NameSpace, path : Path) {
        if (!path || (_.isArray(path) && !path.length)) {
            return nameSpace(ns);
        }

        const [head,tail] = splitPath(path);
        const env = this.findEnv(ns, head);

        if (!env) {
            return notFound([...fromValueList(ns), head]);
        }

        const value = _.get(env.properties, [...ns, head.getValue()]);
        return (typeof value === "object")
            ? env.getObjProperty(ns, head, tail)
            : value;
    }

    has(name : Path | string | symbol) : boolean {
        const getPath = (_.isString(name) || _.isSymbol(name))? parsePath(name) : name;
        const [ns, path] = this.matchNameSpace(getPath);

        if (ns.length && !path.length) {
            return true;
        }

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

    replayHistory(history : Action[]) {
        this.proxyManager.replayHistory(this.properties, history);
    }

    /**
     * Look for a property inside an object.  Used where dot syntax has been used to access a varaible,
     * eg get("foo.bar.baz")
     * @param head 
     * @param tail 
     */
    private getObjProperty(ns : NameSpace, head : PathElement, tail : Path | undefined) : any {
        const obj = _.get(this.properties, [...ns, head.getValue()]);

        if (typeof obj !== "object") {
            throw new Error(head.toString() + " is not an object");
        }

        const result = tail? getFromObj(obj, tail) : obj;
        return result;
    }

    /**
     * Find an environment containing a property
     * @param name the name of the property
     * @returns the matching environment
     */
    private findEnv(ns : NameSpace, name : PathElement) : Optional<Env> {
        // Could we check for references here?
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
        return new Env(obj, [], this); 
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
            const [match, tail] = hasPrefix(nsPath, fromValueList(ns));
            if (match && (longestMatch === undefined || ns.length > longestMatch[0].length)) {
                longestMatch = [ns, tail];
            }
        }
        return longestMatch ?? [[], nsPath];
    }

    reference(pathParam : string | Path) : { [REFERENCE] : Path } {
        const path = _.isString(pathParam) ? parsePath(pathParam) : pathParam;
        if (!this.has(path)) {
            throw Error("Can't create reference to non-extant path: " + JSON.stringify(path));
        }
        return { [REFERENCE] : path};
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
        return notFound(path);
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

function isReference(value : unknown) : boolean {
    return _.isObject(value) && _.has(value, REFERENCE);
}

/** 
 * Create a new root environment, based on the supplied object
 */
export function createRootEnv(obj : Obj, namespaces : NameSpace[] = []) : Env {
    return new Env(obj, [[], ...namespaces]);
}

function nameSpace(ns : NameSpace) : {[NAMESPACE] : NameSpace} {
    return { [NAMESPACE] : ns };
}

export function isFound(value : unknown) : boolean {
    return !(_.isObject(value) && _.has(value, NOT_FOUND));
}

function notFound(path : Path) : { [NOT_FOUND] : Path } {
    return { [NOT_FOUND] : path }
}