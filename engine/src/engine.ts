import { Obj, ObjValue, ObjArray} from "./types"
import { getString, getArray, getObj } from "./obj"
import { VerbTrait, Verb, VerbBuilder } from "./verb"
import { Entity } from "./entity"
import { Env, createRootEnv } from "./env"

enum TAG {
  START = "start"
}

enum TYPE {
  ROOM = "room"
}

export interface Engine {
  getWords(partialCommand : string[]) : string[];
  execute(command : string[]) : void;
}

export interface EngineState {
  entities : Entity[];
  verbs : Verb[];
}

export class BasicEngine {
  private env = createRootEnv();
  private entities : Entity[];
  private verbs : Verb[];

  constructor(entities : Entity[], verbs : Verb[]) {
    this.entities = entities;
    this.verbs = verbs;
    const startingLocs = this.entities.filter(
        entity => entity.getType() === TYPE.ROOM && entity.hasTag(TAG.START));
    if (startingLocs.length == 0) {
      throw new Error("No starting location deffined");
    }
    if (startingLocs.length > 1) {
      throw new Error("Multiple starting locations found");
    }
    this.env.set("location", startingLocs[0].id);
    this.env.set("moveTo", (env : Env) => this.env.set("location", env.get("dest"))); 
  }
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



