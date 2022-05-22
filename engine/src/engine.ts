import { Obj, ObjValue, ObjArray} from "./types"
import { getString, getArray, getObj } from "./obj"
import { VerbTrait, Verb, VerbBuilder } from "./verb"
import { Entity } from "./entity"


export interface Engine {
  getWords(partialCommand : string[]) : string[];
  execute(command : string[]) : void;
}

export interface EngineState {
  entities : Entity[];
  verbs : Verb[];
}

// Think about how to sructure this
// Could we take inspiration from entity component systems
class EngineOld {
  private objs : {[key:string]: Obj} = {};
  
  constructor(objs : Obj[]) {
    for(const obj of objs) {
      this.objs[getString(obj["name"])] = obj;
      if (obj["type"] === "verb") {
        // Create a verb
      } else {
        // Create an enity
      }
    }
  }
}



