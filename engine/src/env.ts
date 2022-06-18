export enum VarType {
    BOOLEAN = "BOOLEAN",
    NUMBER = "NUMBER",
    STRING = "STRING",
    FUNCTION = "FUNCTION",
    ARRAY = "ARRAY",
    OBJECT = "OBJECT"
}

type Obj = {[key:string]:AnyType};

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyObj = {[key:string]:any};
type AnyArray = any[];
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
    value : number;
}

interface VarString {
    type : VarType.STRING,
    value : string
}

interface VarFunction {
    type : VarType.FUNCTION,
    value : (env:Env) => void
}

interface VarArray { 
    type : VarType.ARRAY,
    value : AnyType[]
}

interface VarObject {
    type : VarType.OBJECT
    value : Obj
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

    set<T extends TypeName>(name : string, value : ObjectType<T>) {
        if (!this.writable) {
            throw new Error("Can't set variable on readonly env");
        }
        const [head,tail] = dotSplit(name);
        const env = this.findWritableEnv(name) ?? this;
        if (!tail) {
            env.properties[head] = wrapValue(value);
            return;
        }
        const obj = env.properties[head] ?? wrapValue({});
        if (!env.properties[head]) {
            env.properties[head] = obj;
        }
        if (obj.type != VarType.OBJECT) {
            throw new Error(head + " is not an object");
        }
        setToObj(obj.value, tail, value);
    }

    get<T extends TypeName>(type : T, name : string) : ObjectType<T> {
        const [head,tail] = dotSplit(name);
        const env = this.findEnv(head);
        if (env) {
            const value = env.properties[head];
            if (tail) {
                if (value.type == VarType.OBJECT) {
                    return getFromObj(type, value.value, tail);
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
        if (this.properties[name]) {
            return this;
        } else if (this.parent) {
            return this.parent.findEnv(name);
        } else {
            return undefined;
        }
    }

    findWritableEnv(name : string) : Env | undefined {
        if (this.properties[name]) {
            return this.writable ? this : undefined;
        } else if (this.parent) {
            if (this.parent.writable) {
                return this.parent.findWritableEnv(name);
            } else {
                // If the parent contains the field but isn't writable, return the (writable) child
                return this.parent.findEnv(name) ? this : undefined;
            }
        } else {
            return undefined;
        }
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
                result = makeVar(VarType.OBJECT, mkObj(value as {[key:string]:any}))
            } else {
                throw new Error("Null values are forbidden");
            }
            break;
        default:
            throw new Error("Unknown type");
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

export function createRootEnv(obj : AnyObj, writable : boolean) : Env {
    return new Env(writable, wrapObjectValues(obj));
}

function wrapObjectValues(anyobj : AnyObj) : Obj {
    const obj = {} as Obj;
    for(const [key,value] of Object.entries(anyobj)) {
        obj[key] = wrapValue(value);
    }
    return obj
}