import { Verb } from "./verb"
import { Entity } from "./entity"
import { createRootEnv, ObjBuilder } from "./env"
import { getAllCommands } from "./commandsearch"
import { TextBuffer } from "./textbuffer";
import { Action } from "./action";
import { Obj } from "./types";
import { makePlayer, makeDefaultFunctions, makeBuffer, getPlayer, getBuffer } from "./enginedefault";

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
  getStatus() : string;
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
  private readonly env;
  readonly entities : EntityMap;
  readonly verbs : VerbMap;
  private context : CommandContext;
  private commands : string[][];

  constructor(entities : Entity[], verbs : Verb[]) {
    const environment = {} as Obj; 
    entities.forEach(entity => environment[entity.id] = entity.props);
    verbs.forEach(verb => environment[verb.id] = verb.props);

    this.entities = entities.reduce((map : EntityMap, entity) => {map[entity.id] = entity; return map}, {} );
    this.verbs = verbs.reduce((map : VerbMap, verb) => {map[verb.id] = verb; return map}, {} );

    const start = findStartingLocation(entities);
    makePlayer(environment, start);
    makeDefaultFunctions(environment);
    makeBuffer(environment);

    const rootEnv = createRootEnv(environment, false);
    this.env = rootEnv.newChild();

    this.context = this.getContext();
    this.commands = getAllCommands(this.context.entities, this.context.verbs);
  }

  getContext() : CommandContext {
    // for now just get the entity for the current location
    const contextEntities = [];
    const locationEntity = this.entities[getPlayer(this.env).location];
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
      return getBuffer(this.env);
  }

  getStatus() : string {
    const location = this.entities[getPlayer(this.env).location];
    return location.getName() ?? location.id;
  }
}

function findStartingLocation(entities : Entity[]) : string {
  const startingLocs = entities.filter(
      entity => entity.getType() === TYPE.ROOM && entity.hasTag(TAG.START));
  if (startingLocs.length == 0) {
    throw new Error("No starting location defined");
  }
  if (startingLocs.length > 1) {
    throw new Error("Multiple starting locations found");
  }
  return startingLocs[0].id;
}
