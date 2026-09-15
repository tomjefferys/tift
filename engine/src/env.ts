
/**
 * Implenent exection environment using a history proxy to keep track of changes
 */

import _ from "lodash"
import { pathElementEquals, fromValueList, makePath, toValueList } from "./path";
import { Path, PathElement } from "tift-types/src/path"
import { parsePath } from "./script/pathparser";
import { History } from "tift-types/src/util/historyproxy";
import { createProxy, ProxyManager } from "./util/historyproxy";
import { Optional } from "tift-types/src/util/optional";
import { Obj, isObject } from "./util/objects";
import { AnyArray, EnvFn, ReturnType } from "tift-types/src/env";
import * as Type from "tift-types/src/env";
import { createOverridableProxy, cloneOverlay } from "./util/overrideproxy";

export const REFERENCE = Symbol("__reference__");
export const NAMESPACE = Symbol("__namespace__");
export const NOT_FOUND = Symbol("__notfound__");

export type ReadOnly = "readonly" | "writable";

export type NameSpace = string[];

// An execution envionment for a function.  Contains all local variables, and access to 
// variables in parent environments
export class Env implements Type.Env {
    readonly parent? : Env;
    readonly properties : Obj;
    readonly namespaces : NameSpace[];
    readonly proxyManager : ProxyManager;

    // Space to store temporary variables that won't get saved
    // Allows inter-action communication without updating save game data
    readonly transients : Obj;

    // Memoised result of getNamespaces() - see there for why this is safe.
    private namespacesCache? : NameSpace[];

    constructor(properties : Obj, namespaces : NameSpace[] = [], parent? : Env) {
        [this.properties, this.proxyManager] = createProxy(properties);
        this.parent = parent;
        this.namespaces = namespaces;
        this.transients = {};
    }

    getParent() : Type.Env | undefined {
        return this.parent as Type.Env;
    }

    /**
     * Declare variable in this environment.  Don't look for previous definitions in parent envs
     * Declaration will shadow any variables in wider scopes
     * @param name 
     * @param value 
     */
    def(name : string, value : unknown) {
        this.properties[name] = value;
    }

    /**
     * Set a variable, either in this environment, or in a parent environment if it already
     * exists there
     * @param name 
     * @param value 
     */
    set(name : Path | string | symbol, value : unknown) : void {
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

    setToNameSpace(ns : NameSpace, path : Path, value : unknown) {
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
        if (!isObject(obj)) {
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
    get(name : Path | string | symbol, followReferences = true) : unknown {
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
            getOwnPropertyDescriptor : (target : object, property : string | symbol) => {
                const value = handler.get(target, property);
                return isFound(value) ? { configurable : true, enumerable : true, value } : undefined;
            },
            // If the requested object exist in the nameaspace, return a reference to it
            get : (_target : object, key : string | symbol) => {
                return (this.has(makePath([...ns, key]))) 
                        ? this.reference(makePath([...ns, key])) 
                        : notFound(makePath([key]));
            },
            has : (_target : object, key : string | symbol) => {
                return this.has(makePath([...ns, key]));
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
        const value = this.get(path);
        if (!_.isString(value)) {
            throw new Error(`${name} is not a string`)
        }
        return value;
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
        // Namespaces are fixed at construction (own namespaces never change, and neither
        // does which env is `this.parent`), so this is safe to compute once and reuse -
        // it's on the hot path of every get/set/has/findObjs call.
        if (!this.namespacesCache) {
            const parentNamespaces = this.parent?.getNamespaces() ?? []
            this.namespacesCache = [...this.namespaces, ...parentNamespaces];
        }
        return this.namespacesCache;
    }

    replayHistory(history : History) {
        this.proxyManager.replayHistory(history);
    }

    /**
     * Look for a property inside an object.  Used where dot syntax has been used to access a varaible,
     * eg get("foo.bar.baz")
     * @param head 
     * @param tail 
     */
    private getObjProperty(ns : NameSpace, head : PathElement, tail : Path | undefined) : unknown {
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
        if (typeof fn !== 'function') {
            throw new Error(`${name} is not a function`);
        }
        return this.executeFn(fn as EnvFn, bindings);
    }

    executeFn(fn : EnvFn, bindings : Obj) : ReturnType {
        const fnEnv = this.newChild();
        fnEnv.addBindings(bindings);
        return fn(fnEnv);
    }

    /**
     * @returns a new child environment of the current environment
     */
    newChild(obj : Obj = {}) : Type.Env {
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
     * Find all objects matching a predicate.
     *
     * Walks each requested namespace directly off every env's own properties (nearest env
     * first, so shadowing resolves the same way `get` would), rather than first collecting
     * every candidate name (getAllObjectNames) and then re-resolving each one from scratch
     * via `get` - a full path-parse + reference-expansion + namespace-match + parent-chain
     * walk per name, for a value already in hand.
     * @param predicate
     * @returns
     */
    findObjs(predicate: (obj: Obj) => boolean, namespaces : NameSpace[] = this.getNamespaces()) : Obj[] {
        // Names that are themselves a declared namespace (eg "entities") aren't objects to
        // return, they're containers of objects - matches the `isNameSpace` filter
        // getObjectNamesFromNameSpace used to apply per candidate name. Namespaces are only
        // ever declared on a root env (see createRootEnv/ForkManager.fork), and inherited by
        // every child via the parent chain, so this.getNamespaces() is the same set no
        // matter which env in the chain it's computed from.
        const declaredNamespaces = new Set(this.getNamespaces().map(ns => ns.join(".")));
        const seen = new Set<string>();
        const results : Obj[] = [];

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        for (let env : Env | undefined = this; env; env = env.parent) {
            for (const ns of namespaces) {
                const nsObj = env.getNameSpace(ns);
                if (!nsObj) {
                    continue;
                }
                const prefix = ns.join(".");
                for (const key of Object.keys(nsObj)) {
                    const fullName = prefix ? `${prefix}.${key}` : key;
                    // Nearest env wins on a shadowed name, matching get()'s findEnv
                    // semantics - mark it seen (whatever its value) the first time it's
                    // met, before deciding whether it's a usable object.
                    if (seen.has(fullName) || declaredNamespaces.has(fullName)) {
                        continue;
                    }
                    seen.add(fullName);
                    let value = nsObj[key];
                    if (isReference(value)) {
                        // Namespace entries are never actually stored as references in
                        // practice (reference() is only ever handed out transiently by
                        // createNamespaceReferences), but fall back to a full get() rather
                        // than assume that can't change.
                        value = this.get(makePath([...ns, key]));
                    }
                    if (isObject(value) && predicate(value)) {
                        results.push(value);
                    }
                }
            }
        }
        return results;
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

    setTransient(name : string, value : unknown) : void {
        if (this.parent) {
            this.parent.setTransient(name, value);
        } else {
            this.transients[name] = value;
        }
    }

    getTransient(name : string) : unknown {
        if (this.parent) {
            this.parent.getTransient(name);
        } else {
            return this.transients[name];
        }
    }

    clearTransients() : void {
        if (this.parent) {
            this.parent.clearTransients();
        } else {
            for (const prop of Object.getOwnPropertyNames(this.transients)) {
                delete this.transients[prop];
            }
        }
    }
}

/**
 * Access a value inside an object, referenced using dot syntax
 * @param obj 
 * @param name 
 */
function getFromObj(obj : Obj, path : Path) : unknown {
    const [head, tail] = splitPath(path);
    const value = obj[head.getValue()];
    if (!value) {
        return notFound(path);
    }
    if (!tail) {
        return value;
    } else {
        if (isObject(value)) {
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
function setToObj(obj : Obj, name : Path, value : unknown) {
    const [head,tail] = splitPath(name);
    if (!tail) {
        obj[head.getValue()] = value;
        return;
    }
    const child = obj[head.getValue()] ?? {};
    if (!isObject(child)) {
        throw new Error(head.toString() + " is not an object");
    } 
    const key = head.getValue();
    if (!obj[key]) {
        obj[key] = child;
    }
    // Get the newly set value, to ensure it's proxied
    const proxiedChild = obj[key];
    setToObj(proxiedChild, tail, value);
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

function isReference(value : unknown) : value is {[REFERENCE] : Path} {
    return _.isObject(value) && _.has(value, REFERENCE);
}

/**
 * Create a new root environment, based on the supplied object
 */
export function createRootEnv(obj : Obj, namespaces : NameSpace[] = []) : Type.Env {
    return new Env(obj, [[], ...namespaces]);
}

/**
 * Forks an env for speculative execution, any number of times, cheaply. Each fork is a new
 * root-level env backed by an override proxy over the SAME real root's properties (captured
 * once, in the constructor): reads fall through to the real state; writes are captured in the
 * proxy's overlay and never touch the real state.
 *
 * Forking a fork works too, and stays cheap regardless of how many times you do it: rather than
 * nesting proxies, each fork clones the parent fork's accumulated overlay onto a fresh,
 * single-layer proxy over the same real root - so the proxy nesting depth is always 1, however
 * many times `fork` has been called in a chain. See the warning on createOverridableProxy:
 * nesting override proxies is expensive enough (V8's `[[GetOwnProperty]]` invariant-checking for
 * a Proxy-of-a-Proxy compounds into genuine exponential cost) to make repeated forking - eg
 * simulating a multi-command sequence one command at a time, as commandplanner.ts does -
 * impractical past a handful of levels deep.
 *
 * Used by the command planner (see commandplanner.ts) to simulate commands against
 * hypothetical futures without mutating the game the player is actually in. A single
 * ForkManager is constructed per search, so every fork it produces (however deep) shares the
 * one real root captured at construction time.
 */
export class ForkManager {
    private readonly realRootProperties : Obj;
    private readonly namespaces : NameSpace[];

    /**
     * @param env any env belonging to the environment to fork (its root is what gets forked)
     */
    constructor(env : Type.Env) {
        const root = env.getRoot();
        this.realRootProperties = root.properties;
        this.namespaces = root.getNamespaces();
    }

    /**
     * @param parentOverlay the overlay of the fork being forked further - ie the overlay
     *                       previously returned alongside whichever env is now being passed to
     *                       `fork` as its starting point - or undefined to fork fresh from the
     *                       real root.
     * @returns a tuple of the forked env, and the overlay backing it (needed to read back which
     *          properties were touched - see util/overrideproxy.ts#getTouchedPaths - and to pass
     *          to a later `fork` call, if forking this fork further)
     */
    fork(parentOverlay? : Obj) : [Type.Env, Obj] {
        const overlay = parentOverlay ? cloneOverlay(parentOverlay) : {};
        const proxy = createOverridableProxy(this.realRootProperties, overlay);
        const forked = new Env(proxy, this.namespaces);
        return [forked, overlay];
    }
}

function nameSpace(ns : NameSpace) : {[NAMESPACE] : NameSpace} {
    return { [NAMESPACE] : ns };
}

export function isFound(value : unknown) : boolean {
    return !(_.isObject(value) && _.has(value, NOT_FOUND));
}

export function isNotFound(value : unknown) : value is {[NOT_FOUND] : string } {
    return _.isObject(value) && _.has(value, NOT_FOUND);
}

function notFound(path : Path) : { [NOT_FOUND] : Path } {
    return { [NOT_FOUND] : path }
}