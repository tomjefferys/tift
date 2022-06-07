export enum VarType {
    BOOLEAN = "BOOLEAN",
    NUMBER = "NUMBER",
    STRING = "STRING",
    FUNCTION = "FUNCTION",
    ARRAY = "ARRAY",
    OBJECT = "OBJECT"
}

type Obj = {[key:string]:AnyType};
type EnvFn = (env:Env) => void;

type TypeName = VarType.BOOLEAN | VarType.NUMBER | VarType.STRING | VarType.FUNCTION | VarType.ARRAY | VarType.OBJECT;
type AnyType = VarBool | VarNum | VarString | VarFunction | VarArray | VarObject;

type ObjectType<T> = 
    T extends VarType.BOOLEAN ? boolean :
    T extends VarType.NUMBER ? number :
    T extends VarType.STRING ? string :
    T extends VarType.FUNCTION ? (env:Env) => void :
    T extends VarType.ARRAY ? AnyType[] :
    T extends VarType.OBJECT ? Obj :
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

    //set(name : string, value : AnyType) {
    set<T extends TypeName>(name : string, value : ObjectType<T>) {
        const env = this.find(name) ?? this;
        env.properties[name] = wrapValue(value);
    }

    get<T extends TypeName>(type : T, name : string) : ObjectType<T> {
        const env = this.find(name);
        if (env) {
            const value = env.properties[name];
            if (value.type == type) {
                return value.value as ObjectType<T>;
            } else {
                throw new Error("Variable " + name + " is not a " + type);
            }
        } else {
            throw new Error("No such varible " + name);
        }
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
        const fn = this.get(VarType.FUNCTION, name);
        const fnEnv = this.newChild();
        fnEnv.addBindings(bindings);
        fn(fnEnv);
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
                result = makeVar(VarType.ARRAY, value as AnyType[]);
            } else if (value != null) {
                result = makeVar(VarType.OBJECT, value as Obj)
            } else {
                throw new Error("Null values are forbidden");
            }
            break;
        default:
            throw new Error("Unknown type");
    }
    return result;
}

function makeVar<T extends TypeName>(typeName : T, value : ObjectType<T> ) : AnyType {
    return { type : typeName, value : value} as AnyType;
}

export function createRootEnv() : Env {
    return new Env();
}
