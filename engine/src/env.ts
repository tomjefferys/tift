import { BindingMap, Obj, ObjValue } from "./types"

type EnvFn = (env:Env) => {}

export function createRootEnv() : Env {
    return new Env();
}

// An execution envionment for a function.  Contains all local variables, and access to 
// variables in parent environments
export class Env {
    readonly parent? : Env;
    readonly properties : Obj = {};

    constructor(parent? : Env) {
        this.parent = parent;
    }

    def(name : string, value : ObjValue ) {
        this.properties[name] = value;
    }

    set(name : string, value : ObjValue) {
        const env = this.find(name) ?? this;
        env.properties[name] = value;
    }

    get(name : string) : ObjValue {
        const env = this.find(name);
        if (!env) {
            throw new Error(name + " is undefined");
        }
        return env.properties[name];
    }

    find(name : string) : Env | undefined {
        if (this.properties[name]) {
            return this;
        } else if (this.parent) {
            return this.parent.find(name);
        } else {
            return undefined;
        }
    }

    execute(name : string, bindings : Obj ) {
        const fn = this.get(name);
        if (!fn || typeof fn !== 'function') {
            throw new Error(name + " is not a function");
        }
        const fnEnv = this.newChild();
        fnEnv.addBindings(bindings);
        fn(fnEnv);
    }

    newChild() : Env {
        return new Env(this);
    }

    addBindings(bindings : Obj) {
        for(const [key, value] of Object.entries(bindings)) {
            this.def(key, value);
        }
    }
}