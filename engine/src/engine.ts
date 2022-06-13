import { Verb } from "./verb"
import { Entity } from "./entity"
import { Env, createRootEnv, VarType, ObjBuilder } from "./env"
import { getAllCommands } from "./commandsearch"
import { TextBuffer, createTextBuffer } from "./textbuffer";
import { Action } from "./action";
import { StringLiteral } from "@babel/types";

type EntityMap = {[key:string]:Entity}
type VerbMap = {[key:string]:Verb}

enum TAG {
  START = "start"
}

enum TYPE {
  ROOM = "room"
}

export interface Engine {
  getWords(partialCommand : string[]) : string[];
  execute(command : string[]) : void;
  getBuffer() : TextBuffer;
  getStatus() : String;
}

export interface EngineState {
  entities : {[key:string]:Entity};
  verbs : {[key:string]:Verb};
}

interface CommandContext {
  entities : Entity[];
  verbs : Verb[];
}

export class BasicEngine implements Engine {
  private readonly env = createRootEnv();
  readonly entities : EntityMap;
  readonly verbs : VerbMap;
  readonly buffer : TextBuffer;
  private context : CommandContext;
  private commands : string[][];
  private location : string;

  constructor(entities : Entity[], verbs : Verb[]) {
    this.entities = entities.reduce((map : EntityMap, entity) => {map[entity.id] = entity; return map}, {} );
    this.verbs = verbs.reduce((map : VerbMap, verb) => {map[verb.id] = verb; return map}, {} );
    const startingLocs = Object.values(this.entities).filter(
        entity => entity.getType() === TYPE.ROOM && entity.hasTag(TAG.START));
    if (startingLocs.length == 0) {
      throw new Error("No starting location defined");
    }
    if (startingLocs.length > 1) {
      throw new Error("Multiple starting locations found");
    }
    this.location = startingLocs[0].id;
    this.makeDefaultFunctions();
    this.env.set("moveTo", (env : Env) => 
      this.env.execute("setLocation", new ObjBuilder().with("dest",env.get(VarType.STRING, "dest")).build()));
    this.buffer = createTextBuffer();
    this.context = this.getContext();
    this.commands = getAllCommands(this.context.entities, this.context.verbs);
  }

  makeDefaultFunctions() {
    this.env.set("setLocation", env => this.location = env.get(VarType.STRING, "dest"));
    this.env.set("getLocation", _ => this.location);
    this.env.set("getEntity", env => {
      const entityId = env.get(VarType.STRING, "id")
      return this.entities[entityId];
    });
    this.env.set("write", env => this.buffer.write(env.get(VarType.STRING, "value")));
  }

  getContext() : CommandContext {
    // for now just get the entity for the current location
    const contextEntities = [];
    const locationEntity = this.entities[this.location];
    if (locationEntity) {
      contextEntities.push(locationEntity);
    }
    return {
      entities: contextEntities,
      verbs: Object.values(this.verbs)
    }
  }

  getWords(partial : string[]): string[] {
    const nextWords = new Set<string>();
    for(const command of this.commands) {
      if (partial.length < command.length) {
        let match = true;
        let i=0;
        for(const word of partial) {
          if (word !== command[i]) {
            match = false;
            break;
          }
          i++;
        }
        if (match) {
          nextWords.add(command[i]);
        }
      }
    }
    return Array.from(nextWords);
  }

  
  execute(command: string[]): void {
    const actions : Action[] = [...this.context.entities, ...this.context.verbs].flatMap(obj => obj.actions);
    for (const action of actions) {
        const result = action.matcher(command);
        if (result.match) {
          const actionEnv = this.env.newChild();
          const bindings = new ObjBuilder();
          for(const [key,value] of Object.entries(result.bindings)) {
            bindings.with(key, value);
          }
          actionEnv.addBindings(bindings.build());
          action.action(actionEnv);
          this.context = this.getContext();
          // TODO Break out?  Or run all matching actions?
        }
    }
    this.commands = getAllCommands(this.context.entities, this.context.verbs);
  }

  getBuffer(): TextBuffer {
      return this.buffer;
  }

  getStatus() : string {
    const location = this.entities[this.location];
    return location.getName() ?? location.id;
  }
}


