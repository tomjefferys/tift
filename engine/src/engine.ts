import { VerbTrait, Verb, VerbBuilder } from "./verb"
import { Entity } from "./entity"
import { Env, createRootEnv } from "./env"
import { getAllCommands } from "./commandsearch"

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

interface CommandContext {
  entities : Entity[];
  verbs : Verb[];
}

export class BasicEngine implements Engine {
  private readonly env = createRootEnv();
  readonly entities : Entity[];
  readonly verbs : Verb[];
  private context : CommandContext;
  private commands : string[][];

  constructor(entities : Entity[], verbs : Verb[]) {
    this.entities = entities;
    this.verbs = verbs;
    const startingLocs = this.entities.filter(
        entity => entity.getType() === TYPE.ROOM && entity.hasTag(TAG.START));
    if (startingLocs.length == 0) {
      throw new Error("No starting location defined");
    }
    if (startingLocs.length > 1) {
      throw new Error("Multiple starting locations found");
    }
    this.env.set("location", startingLocs[0].id);
    this.env.set("moveTo", (env : Env) => this.env.set("location", env.get("dest"))); 
    this.context = this.getContext();
    this.commands = getAllCommands(this.context.entities, this.context.verbs);
  }

  // TODO pass verbs through to the engine constructor
  addDefaultVerbs() {
    this.verbs.push(
      new VerbBuilder("go")
                  .withTrait(VerbTrait.Intransitive)
                  .withModifier("direction")
                  .build());
  }

  getContext() : CommandContext {
    // for now just get the entity for the current location
    const location = this.env.get("location");
    const contextEntities = [];
    for(const entity of this.entities) {
      if (entity.id == location) {
        contextEntities.push(entity);
      }
    }
    return {
      entities: contextEntities,
      verbs: this.verbs
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
    for(const entity of this.context.entities) {
      for(const action of entity.actions) {
        const result = action.matcher(command);
        if (result.match) {
          const actionEnv = this.env.newChild();
          actionEnv.addBindings(result.bindings);
          action.action(actionEnv);
          this.context = this.getContext();
          // TODO Break out?  Or run all matching actions?
        }
      }
    }
    this.commands = getAllCommands(this.context.entities, this.context.verbs);
  }
}


