
export type ElementType = "property" | "index" | "namespace";

export type NameType = string | symbol;

export type PathElementType = NameType | number;

export interface PathElement {
    type : ElementType;
    getValue : () => PathElementType,
    toString : () => string
}

export type Path = PathElement[];