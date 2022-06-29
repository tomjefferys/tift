import * as _ from "lodash"


const OVERRIDE = Symbol("__override__");


export type ObjKey = string | symbol;

// Either an ObjKey, or an array of ObjKeys with at least one element
export type ObjPath = ObjKey | ObjKey[];

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Obj = {[key:ObjKey]:any};
export type AnyArray = any[];
/* eslint-disable @typescript-eslint/no-explicit-any */

export type EnvFn = (env:Env) => ReturnType;

export type ReturnType = boolean | number | string | EnvFn | Obj | AnyArray | void;

// An execution envionment for a function.  Contains all local variables, and access to 
// variables in parent environments
export class Env {
    readonly parent? : Env;
    readonly properties : Obj;
    readonly writable : boolean;

    constructor(writable : boolean, properties : Obj, parent? : Env) {
        this.parent = parent;
        this.writable = writable;
        this.properties = properties;
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
        const [head,tail] = dotSplit(name);
        const [env, isOverride] = this.findWritableEnv(head) ?? [this, false];
        if (!tail) {
            env.properties[head] = value;
            return;
        }
        const obj = env.properties[head] ?? {};
        if (typeof obj !== "object") {
            throw new Error(head.toString() + " is not an object");
        }
        if (isOverride) {
            obj[OVERRIDE] = true;
        }
        if (!env.properties[head]) {
            env.properties[head] = obj;
        }
        setToObj(obj, tail, value);
    }

    /**
     * Get a variable. Will search parent environments, as well as this one.
     * @param name 
     * @returns 
     */
    get(name : ObjKey) : any {
        const [head,tail] = dotSplit(name);
        const env = this.findEnv(head);

        if (!env) {
            throw new Error("No such varible " + name.toString());
        }

        let value = env.properties[head];
        return (typeof value === "object")
            ? env.getObjProperty(head,tail)
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

    /**
     * Look for a property inside an object.  Used where dot syntax has been used to access a varaible,
     * eg get("foo.bar.baz")
     * @param head 
     * @param tail 
     */
    private getObjProperty(head : ObjKey, tail : ObjPath | undefined) : any {
        const value = this.properties[head];

        if (typeof value !== "object") {
            throw new Error(head.toString() + " is not an object");
        }

        const obj = (value[OVERRIDE] && this.parent)
                        ? { ...this.parent.get(head), ...value}
                        : value;
        
        delete obj[OVERRIDE];

        const result = tail? getFromObj(obj, tail) : obj;
        return _.cloneDeep(result);
    }

    /**
     * Find an environment containing a property
     * @param name the name of the property
     * @returns the matching environment
     */
    private findEnv(name : ObjKey) : Env | undefined {
        return this.properties[name]
                ? this
                : this.parent?.findEnv(name);
    }

    /**
     * Check if an environment, or one of it's ancestors has a property
     * @param name the name of the property
     * @returns true if the property exists
     */
    private hasProperty(name : ObjKey) : boolean {
        return this.properties[name]
                    ? true
                    : this.parent?.hasProperty(name) ?? false;
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
    private findWritableEnv(name : ObjKey) : [Env,boolean] | undefined {
        let result : [Env,boolean] | undefined = undefined;
        if (this.properties[name] && this.writable) {
            result = [this,false];
        } else if (this.parent) {
            if (this.parent.writable) {
                result = this.parent.findWritableEnv(name);
            } else if (this.parent.hasProperty(name)) {
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
    newChild() : Env {
        return new Env(true, {}, this);
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

    /**
     * @returns the names of all object in this (and parent) envs
     */
    getAllObjectNames() : Set<ObjKey> {
        const objNames = this.parent?.getAllObjectNames() ?? new Set<ObjKey>();
        for(const [name,value] of Object.entries(this.properties)) {
            if (typeof value === "object") {
                objNames.add(name);
            }
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
    } else if (typeof path === "string") {
        const dotIndex = path.indexOf(".");
        const dotFound = dotIndex != -1;
        const head = dotFound ? path.substring(0, dotIndex) : path;
        const tail = dotFound ? path.substring(dotIndex + 1) : undefined;
        return [head, tail];
    } else {
        const head = path[0];
        const tail = (path.length > 1)? path.slice(1) : undefined;
        return [head, tail];
    }
}

/** 
 * Create a new root environment, based on the supplied object
 */
export function createRootEnv(obj : Obj, writable : boolean) : Env {
    return new Env(writable, obj);
}