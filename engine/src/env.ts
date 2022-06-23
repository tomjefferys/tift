const OVERRIDE = "__override__"; // TODO use symbol


/* eslint-disable @typescript-eslint/no-explicit-any */
export type Obj = {[key:string]:any};
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

    def(name : string, value : any) {
        this.properties[name] = value;
    }

    // TODO need syntax for accessing arrays
    set(name : string, value : any) {
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
            throw new Error(head + " is not an object");
        }
        if (isOverride) {
            obj[OVERRIDE] = true;
        }
        if (!env.properties[head]) {
            env.properties[head] = obj;
        }
        setToObj(obj, tail, value);
    }

    get(name : string) : any {
        const [head,tail] = dotSplit(name);
        const env = this.findEnv(head);

        if (!env) {
            throw new Error("No such varible " + name);
        }

        if (tail) {
            return env.getObjProperty(head, tail);
        }

        return env.properties[head];
    }

    getStr(name : string) : string {
        return this.get(name) as string;
    }

    private getObjProperty(head : string, tail : string) : any {
        const value = this.properties[head];

        if (typeof value !== "object") {
            throw new Error(head + " is not an object");
        }

        const obj = (value[OVERRIDE] && this.parent)
                        ? { ...this.parent.get(head), ...value}
                        : value;

        return getFromObj(obj, tail); 
    }

    /**
     * Find an environment containing a property
     * @param name the name of the property
     * @returns the matching environment
     */
    findEnv(name : string) : Env | undefined {
        return this.properties[name]
                ? this
                : this.parent?.findEnv(name);
    }

    /**
     * Check if an environment, or one of it's ancestors has a property
     * @param name the name of the property
     * @returns true if the property exists
     */
    hasProperty(name : string) : boolean {
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
    findWritableEnv(name : string) : [Env,boolean] | undefined {
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

    execute(name : string, bindings : Obj ) : ReturnType {
        const fn = this.get(name);
        const fnEnv = this.newChild();
        fnEnv.addBindings(bindings);
        return fn(fnEnv);
    }

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
}

export function mkObj(obj : Obj) : Obj {
    const builder = new ObjBuilder();
    for(const [key, value] of Object.entries(obj)) {
        builder.with(key, value);
    }
    return builder.build();
}

export function mkArr(arr: AnyArray) : any[] {
    return arr.map(value => value);
}

// TODO don't really need this anymore
export class ObjBuilder {
    readonly obj : Obj = {};

    with(name : string, value : any ) : ObjBuilder {
        this.obj[name] = value;
        return this;
    }

    build() : Obj {
        return this.obj;
    }

}

function getFromObj(obj : Obj, name : string) : any {
    const [head, tail] = dotSplit(name);
    const value = obj[head];
    if (!value) {
        throw new Error("Variable " + head + " does not exist");
    }
    if (!tail) {
        return value;
    } else {
        if (typeof value === "object") {
            return getFromObj(value, tail);
        } else {
            throw new Error(head + " is not an object");
        }
    }
}

function setToObj(obj : Obj, name : string, value : any) {
    const [head,tail] = dotSplit(name);
    if (!tail) {
        obj[name] = value;
        return;
    }
    const child = obj[head] ?? {};
    if (!obj[head]) {
        obj[head] = child;
    }
    if (typeof child !== "object") {
        throw new Error(name + " is not an object");
    } 
    setToObj(child, tail, value);
}

function dotSplit(name : string) : [string, string | undefined] {
    const dotIndex = name.indexOf(".");
    const dotFound = dotIndex != -1;
    const head = dotFound ? name.substring(0, dotIndex) : name;
    const tail = dotFound ? name.substring(dotIndex + 1) : undefined;
    return [head, tail];
}

export function createRootEnv(obj : Obj, writable : boolean) : Env {
    return new Env(writable, obj);
}