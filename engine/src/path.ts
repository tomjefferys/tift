import _ from "lodash";

export type ElementType = "property" | "index"

export type NameType = string | symbol;
export type PathElementType = NameType | number;

export interface PathElement {
    type : ElementType;
    getValue : () => PathElementType,
    toString : () => string
}


export interface Property extends PathElement {
    type : "property",
    name : NameType
}

export interface Index extends PathElement {
    type : "index",
    index : number
}

export type Path = PathElement[];

export function isPath(obj : unknown) : obj is Path {
    let isValidPath = _.isArray(obj);
    if (isValidPath) {
        for(const element of (obj as unknown[])) {
            const pathElement = element as PathElement;
            isValidPath = (pathElement?.type === "property" && _.has(pathElement, "name")) 
                            || (pathElement?.type === "index" && _.has(pathElement, "index"));
            if (!isValidPath) {
                break;
            }
        }
    }
    return isValidPath;
}

export function property(name : NameType) : Property {
    const prop : Property = {
        type : "property",
        name : name,
        getValue : () => name,
        toString : () => prop.getValue().toString()
    }
    return prop;
}

export function index(num : number) : Index {
    const index : Index = {
        type : "index",
        index : num,
        getValue : () => num,
        toString : () => index.getValue().toString()
    }
    return index;
}

export function makePath(values : PathElementType[]) : Path {
    return values.map(value => _.isNumber(value)? index(value) : property(value));
}

export function toValueList(path : Path) : PathElementType[] {
    return path.map(e => e.getValue());
}

export function fromValueList(values : PathElementType[]) : PathElement[] {
    return values.map(value => _.isNumber(value)? index(value) : property(value));
}

export function pathElementEquals(element1 : PathElement, element2 : PathElement) : boolean {
    if (_.isUndefined(element1) || _.isUndefined(element2)) {
        return false;
    }
    if (element1.type !== element2.type) {
        return false;
    }
    return (element1.type === "index")
        ? (element1 as Index).index === (element2 as Index).index
        : (element1 as Property).name === (element2 as Property).name;
}