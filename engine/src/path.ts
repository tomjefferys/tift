import _ from "lodash";

import { NameType, PathElement, PathElementType, Path } from "tift-types/src/path"

export type Type = Path;

type PossiblePath = Path | PathElement | (PathElement | PathElementType)[] | PathElementType;

export interface Property extends PathElement {
    type : "property",
    name : NameType
}

export interface Index extends PathElement {
    type : "index",
    index : number
}

export interface NameSpace extends PathElement {
    type : "namespace",
    namespace : string;
}

export function isPath(obj : unknown) : obj is Path {
    let isValidPath = _.isArray(obj);
    if (isValidPath) {
        isValidPath = (obj as unknown[]).every(isPathElement);
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

export function namespace(name : string) : NameSpace {
    const ns : NameSpace = {
        type : "namespace",
        namespace : name,
        getValue : () => name,
        toString : () => ns.getValue().toString()
    }
    return ns;
}

export function makePath(values : (PathElement | PathElementType)[]) : Path {
    return values.map((value,i) => {
        if (isPathElement(value)) {
            if (value.type === "namespace" && i > 0) {
                throw new Error("Namespace must be first element in path");
            }
            return value;
        }
        return _.isNumber(value)? index(value) : property(value);
    });
}

export function concat(path1 : PossiblePath, path2 : PossiblePath) : Path {
    return [...of(path1), ...of(path2)];
}

export function of(path : PossiblePath) : Path {
    return _.isArray(path)
                ? (isPath(path)? path : makePath(path))
                : (isPathElement(path)? [path] : makePath([path]));
}

function isPathElement(element : unknown) : element is PathElement {
    const pathElement = element as PathElement;
    return (pathElement?.type === "property" && _.has(pathElement, "name")) 
                        || (pathElement?.type === "index" && _.has(pathElement, "index"))
                        || (pathElement?.type === "namespace" && _.has(pathElement, "namespace"));
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

export function equals(path1 : Path, path2 : Path) : boolean {
    if (path1.length !== path2.length) {
        return false;
    }
    return path1.every((element, index) => pathElementEquals(element, path2[index]));
}

export function toString(path : Path) {
    return path.map((e, index) => {
        if (isProperty(e)) {
            return ((index != 0)? "." : "") + e.name.toString();
        } else if(isIndex(e)) {
            return `[${e.index}]`;
        } else if (isNameSpace(e)) {
            return e.namespace.toString();
        }
    }).join("");
}

function isProperty(element : PathElement) : element is Property {
    return element.type === "property";
}

function isIndex(element : PathElement) : element is Index {
    return element.type === "index";
}

function isNameSpace(element : PathElement) : element is NameSpace {
    return element.type === "namespace";
}