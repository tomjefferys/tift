import { Verb } from "./verb"
import { Entity } from "./entity"

export type VerbMap = {[key:string]:Verb}
export type EntityMap  = {[key:string]:Entity}

export type ObjValue = Obj | ObjArray | string | number;
export type ObjArray = ObjValue[];
export type Obj = {[key:string] : ObjValue};

export function stringValue(value : ObjValue) : string {
  if (typeof value != 'string') {
    throw new Error(JSON.stringify(value) + " is not a string"); 
  }
  return value;
}
