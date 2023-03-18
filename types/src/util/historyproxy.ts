import * as objects from "./objects";

type PropType = objects.PropType;
type Obj = objects.Obj;

export type Action = Set | Del;

export interface Set {
    type : "Set",
    property : PropType[],
    newValue : any,
    replace? : boolean
}

export interface Del {
    type : "Del",
    property : PropType[]
}