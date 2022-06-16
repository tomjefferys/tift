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
    readonly properties : Obj = {};

    constructor(parent? : Env) {
        this.parent = parent;
    }

    def<T extends TypeName>(name : string, value : ObjectType<T> ) {
        this.properties[name] = wrapValue(value);
    }

    set<T extends TypeName>(name : string, value : ObjectType<T>) {
        const env = this.findEnv(name) ?? this;
        env.properties[name] = wrapValue(value);
    }

    get<T extends TypeName>(type : T, name : string) : ObjectType<T> {
        const dotIndex = name.indexOf(".");
        const rootName = (dotIndex > -1)? name.substring(0, dotIndex) : name;
        const env = this.findEnv(rootName);
        if (env) {
            const value = env.properties[rootName];
            if (dotIndex > -1) {
                if (value.type == VarType.OBJECT) {
                    return this.getFromObj(type, value.value, name.substring(dotIndex + 1));
                } else {
                    throw new Error(rootName + " is not an object");
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

    getFromObj<T extends TypeName>(type : T, obj : Obj, name : string) : ObjectType<T> {
        const [head, tail] = name.split(".", 2);
        const value = obj[head];
        if (!value) {
            throw new Error("Variable " + head + " does not exist");
        }
        if (!tail) {
            if (value.type == type) {
                return unwrap(type, value);
            } else if (!value) {
                throw new Error("Variable " + head + " is not a " + type);
            }
        } else {
            if (value.type == VarType.OBJECT) {
                return this.getFromObj(type, value.value, tail);
            } else {
                throw new Error(head + " is not an object");
            }
        }
        throw new Error("Should not get here");
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

    execute(name : string, bindings : Obj ) : ReturnType {
        const fn = this.get(VarType.FUNCTION, name);
        const fnEnv = this.newChild();
        fnEnv.addBindings(bindings);
        return fn(fnEnv);
    }

    newChild() : Env {
        return new Env(this);
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

export function createRootEnv() : Env {
    return new Env();
}
