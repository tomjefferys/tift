export enum VarType {
    BOOLEAN = "BOOLEAN",
    NUMBER = "NUMBER",
    STRING = "STRING",
    FUNCTION = "FUNCTION",
    ARRAY = "ARRAY",
    OBJECT = "OBJECT"
}

export type Obj = {[key:string]:AnyType};

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyObj = {[key:string]:any};
export type AnyArray = any[];
/* eslint-disable @typescript-eslint/no-explicit-any */

export type EnvFn = (env:Env) => ReturnType;

export type ReturnType = boolean | number | string | EnvFn | AnyObj | AnyArray | void;

type TypeName = VarType.BOOLEAN | VarType.NUMBER | VarType.STRING | VarType.FUNCTION | VarType.ARRAY | VarType.OBJECT;
type AnyType = VarBool | VarNum | VarString | VarFunction | VarArray | VarObject;

type ObjectType<T> = 
    T extends VarType.BOOLEAN ? boolean :
    T extends VarType.NUMBER ? number :
    T extends VarType.STRING ? string :
    T extends VarType.FUNCTION ? EnvFn :
    T extends VarType.ARRAY ? AnyArray :
    T extends VarType.OBJECT ? AnyObj :
    never;

interface VarBool {
    type : VarType.BOOLEAN,
    value : boolean
}

interface VarNum {
    type : VarType.NUMBER,
    value : number,
}

interface VarString {
    type : VarType.STRING,
    value : string,
}

interface VarFunction {
    type : VarType.FUNCTION,
    value : (env:Env) => void,
}

interface VarArray { 
    type : VarType.ARRAY,
    value : AnyType[],
    override : boolean
}

interface VarObject {
    type : VarType.OBJECT
    value : Obj,
    override : boolean
}

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

    def<T extends TypeName>(name : string, value : ObjectType<T> ) {
        this.properties[name] = wrapValue(value);
    }

    // TODO need syntax for accessing arrays
    set<T extends TypeName>(name : string, value : ObjectType<T>) {
        if (!this.writable) {
            throw new Error("Can't set variable on readonly env");
        }
        const [head,tail] = dotSplit(name);
        const [env, isOverride] = this.findWritableEnv(head) ?? [this, false];
        if (!tail) {
            env.properties[head] = wrapValue(value);
            return;
        }
        const obj = env.properties[head] ?? wrapValue({});
        if (obj.type != VarType.OBJECT) {
            throw new Error(head + " is not an object");
        }
        if (isOverride) {
            obj.override = true;
        }
        if (!env.properties[head]) {
            env.properties[head] = obj;
        }
        setToObj(obj.value, tail, value);
    }

    // FIXME this won't get the entire object if an alteration has been made, 
    // and it's been saved to a child env
    get<T extends TypeName>(type : T, name : string) : ObjectType<T> {
        const [head,tail] = dotSplit(name);
        const env = this.findEnv(head);
        if (env) {
            const value = env.properties[head];
            if (tail) {
                if (value.type == VarType.OBJECT) {
                    let obj;
                    if (value.override && env.parent) {
                        const parentResult = env.parent.get(VarType.OBJECT, head);
                        const unwrapped = unwrap(VarType.OBJECT, value);
                        obj = wrapObjectValues({...parentResult, ...unwrapped});//...value.value};
                    } else {
                        obj = value.value;
                    }
                    return getFromObj(type, obj, tail); 
                } else {
                    throw new Error(head + " is not an object");
                }
            }
            if (value.type == type) {
                return unwrap(type, value);
            } else {
                throw new Error("Variable " + name + " is not a " + type);
            }
        } else {
            throw new Error("No such varible " + name);
        }
    }

    findEnv(name : string) : Env | undefined {
        let result : Env | undefined;
        if (this.properties[name]) {
            // eslint-disable-next-line @typescript-eslint/no-this-alias 
            result = this;
        } else if (this.parent) {
            result = this.parent.findEnv(name);
        } else {
            result = undefined;
        }
        return result;
    }

    // Find a writable env, return the env alongside a boolean indicating if 
    // we're overriding a readonly value
    findWritableEnv(name : string) : [Env,boolean] | undefined {
        let result : [Env,boolean] | undefined;
        if (this.properties[name]) {
            result = this.writable ? [this,false] : undefined;
        } else if (this.parent) {
            if (this.parent.writable) {
                result = this.parent.findWritableEnv(name);
            } else {
                // If the parent contains the field but isn't writable, return the (writable) child
                result = this.parent.findEnv(name) ? [this,true] : undefined;
            }
        } else {
            result = undefined;
        }
        return result;
    }

    execute(name : string, bindings : Obj ) : ReturnType {
        const fn = this.get(VarType.FUNCTION, name);
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

export function mkObj(obj : AnyObj) : Obj {
    const builder = new ObjBuilder();
    for(const [key, value] of Object.entries(obj)) {
        builder.with(key, value);
    }
    return builder.build();
}

export function mkArr(arr: AnyArray) : AnyType[] {
    return arr.map(value => wrapValue(value));
}

export class ObjBuilder {
    readonly obj : Obj = {};

    with<T extends TypeName>(name : string, value : ObjectType<T> ) : ObjBuilder {
        this.obj[name] = wrapValue(value);
        return this;
    }

    build() : Obj {
        return this.obj;
    }

}

function getFromObj<T extends TypeName>(type : T, obj : Obj, name : string) : ObjectType<T> {
    const [head, tail] = dotSplit(name);
    const value = obj[head];
    if (!value) {
        throw new Error("Variable " + head + " does not exist");
    }
    if (!tail) {
        if (value.type == type) {
            return unwrap(type, value);
        } else {
            throw new Error("Variable " + head + " is not a " + type);
        }
    } else {
        if (value.type == VarType.OBJECT) {
            return getFromObj(type, value.value, tail);
        } else {
            throw new Error(head + " is not an object");
        }
    }
}

function setToObj<T extends TypeName>(obj : Obj, name : string, value : ObjectType<T>) {
    const [head,tail] = dotSplit(name);
    if (!tail) {
        obj[name] = wrapValue(value);
        return;
    }
    const child = obj[head] ?? wrapValue({});
    if (!obj[head]) {
        obj[head] = child;
    }
    if (child.type !== VarType.OBJECT) {
        throw new Error(name + " is not an object");
    } 
    setToObj(child.value, tail, value);
}

function dotSplit(name : string) : [string, string | undefined] {
    const dotIndex = name.indexOf(".");
    const dotFound = dotIndex != -1;
    const head = dotFound ? name.substring(0, dotIndex) : name;
    const tail = dotFound ? name.substring(dotIndex + 1) : undefined;
    return [head, tail];
}

function wrapValue<T extends TypeName>(value : ObjectType<T>) : AnyType {
    const type = typeof value;
    let result : AnyType;
    switch(type) {
        case "boolean":
            result = makeVar(VarType.BOOLEAN, value as boolean);
            break;
        case "number":
            result = makeVar(VarType.NUMBER, value as number);
            break;
        case "string":
            result = makeVar(VarType.STRING, value as string);
            break;
        case "function":
            result = makeVar(VarType.FUNCTION, value as EnvFn);
            break;
        case "object":
            if (Array.isArray(value)) {
                result = makeVar(VarType.ARRAY, mkArr(value));
            } else if (value != null) {
                result = makeObj(mkObj(value as {[key:string]:any}), false);
            } else {
                throw new Error("Null values are forbidden");
            }
            break;
        default:
            throw new Error("Unknown type: " + type);
    }
    return result;
}

function unwrap<T extends TypeName>(type : T, wrappedValue : AnyType) : ObjectType<T> {
    if (type === wrappedValue.type) {
        if (isSimpleType(type)) {
            return wrappedValue.value as ObjectType<T>;
        } else if (type === VarType.ARRAY) {
            const arr = [] as AnyArray;
            for(const item of (wrappedValue.value as AnyType[])) {
                arr.push(unwrap(item.type, item))
            }
            return arr as ObjectType<T>
        } else if (type == VarType.OBJECT) {
            const obj = {} as AnyObj;
            for(const [key,value] of Object.entries(wrappedValue.value)) {
                obj[key] = unwrap(value.type, value);
            }
            return obj as ObjectType<T>;
        } else {
            throw new Error(type + " is an unknow type");
        }
        
    } else {
        throw new Error("value is wrong type");
    }
}

function isSimpleType(type : TypeName ) {
    switch(type) {
        case VarType.BOOLEAN:
        case VarType.NUMBER:
        case VarType.STRING:
        case VarType.FUNCTION:
            return true;
        default:
            return false;
    }
}

function makeVar<T extends TypeName>(typeName : T, value : ObjectType<T> ) : AnyType {
    return { type : typeName, value : value} as AnyType;
}

function makeObj(value : AnyObj, override : boolean) : VarObject {
    return { type : VarType.OBJECT, value : value, override : override};
}

export function createRootEnv(obj : AnyObj, writable : boolean) : Env {
    return new Env(writable, wrapObjectValues(obj));
}

function wrapObjectValues(anyobj : AnyObj) : Obj {
    const obj = {} as Obj;
    for(const [key,value] of Object.entries(anyobj)) {
        try {
            obj[key] = wrapValue(value);
        } catch (e) {
            throw new Error("Could not wrap [" + key + "," + value + "]: " + e)
        }
    }
    return obj
}