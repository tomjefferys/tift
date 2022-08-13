import { Verb } from "./verb"
import { Entity } from "./entity"
import { createRootEnv } from "./env"
import { ContextEntities, getAllCommands, buildSearchContext, searchExact } from "./commandsearch"
import { Action } from "./action";
import { Obj } from "./types";
import { makePlayer, makeDefaultFunctions, getPlayer, makeOutputConsumer } from "./enginedefault";
import { OutputConsumer } from "./messages/output";
import { IdValue } from "./shared";
import { MultiDict } from "./util/multidict";
import * as multidict from "./util/multidict";
import * as _ from "lodash"
import { addLibraryFunctions } from "./script/library";

type EntityMap = {[key:string]:Entity}
type VerbMap = {[key:string]:Verb}

enum TAG {
  START = "start"
}

enum TYPE {
  ROOM = "room"
}

export interface Engine {
  getWords(partialCommand : string[]) : IdValue<string>[];
  execute(command : string[]) : void;
  getStatus() : string;
}

export interface EngineState {
  entities : {[key:string]:Entity};
  verbs : {[key:string]:Verb};
}

interface CommandContext {
  entities : ContextEntities;
  verbs : Verb[];
}

export class BasicEngine implements Engine {
  private readonly env;
  // FIXME entites are both being stored in the env, and here.
  // I think they should only be in the env (possibly cached here)
  readonly entities : EntityMap;
  readonly verbs : VerbMap;
  private context : CommandContext;
  private commands : IdValue<string>[][];

  constructor(entities : Entity[], verbs : Verb[], outputConsumer : OutputConsumer, objs : Obj[]) {
    const environment = {} as Obj; 
    objs.forEach(obj => environment[obj.id as string] = obj); // FIXME reject anything without an id
    entities.forEach(entity => environment[entity.id] = entity.props);
    verbs.forEach(verb => environment[verb.id] = verb.props);

    this.entities = entities.reduce((map : EntityMap, entity) => {map[entity.id] = entity; return map}, {} );
    this.verbs = verbs.reduce((map : VerbMap, verb) => {map[verb.id] = verb; return map}, {} );

    const start = findStartingLocation(entities);
    makePlayer(environment, start);
    makeDefaultFunctions(environment);
    makeOutputConsumer(environment, outputConsumer);
    addLibraryFunctions(environment);

    const rootEnv = createRootEnv(environment, false);
    this.env = rootEnv.newChild();

    this.context = this.getContext();

    // FIXME this should be done a bit at a time
    this.commands = getAllCommands(this.context.entities, this.context.verbs);
  }

  getContext() : CommandContext {
    // Entity for the current location
    const contextEntities : MultiDict<Entity> = {};
    const location = getPlayer(this.env).location;
    const locationEntity = this.entities[location];
    if (locationEntity) {
      multidict.add(contextEntities, "environment", locationEntity);
    }

    // Get any other entities that are here
    this.env.findObjs(obj => obj?.location === location)
            .map(obj => this.entities[obj.id])
            .forEach(entity => multidict.add(contextEntities, "environment", entity));

    // Get inventory entities
    this.env.findObjs(obj => obj?.location === "INVENTORY")
            .map(obj => this.entities[obj.id])
            .forEach(entity => multidict.add(contextEntities, "inventory", entity));
  
    return {
      entities: contextEntities,
      verbs: Object.values(this.verbs)
    }
  }

  getWords(partial : string[]): IdValue<string>[] {
    const nextWords = new Set<IdValue<string>>();
    for(const command of this.commands) {
      if (partial.length < command.length) {
        let match = true;
        let i=0;
        for(const word of partial) {
          if (word !== command[i].id) {
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
    const allEntities = _.flatten(Object.values(this.context.entities))
    const actions : Action[] = [...allEntities, ...this.context.verbs]
                                  .flatMap(obj => obj?.actions ?? []);

    const searchContext = buildSearchContext(this.context.entities, this.context.verbs);
    const searchState = searchExact(command, searchContext);
    if (!searchState) {
      throw new Error("Could not match command: " + JSON.stringify(command));
    }

    for (const action of actions) {
        const result = action.matcher(searchState);
        if (result.isMatch) {
          this.env.executeFn(action.action, result.captures ?? {});
          this.context = this.getContext();
          // TODO Break out?  Or run all matching actions?
        }
    }

    // Find and execute any rules
    const rules = this.env.findObjs(obj => obj["type"] === "rule");
    const expressions = rules.flatMap(rules => rules["__COMPILED__"]);
    expressions.forEach(expr => expr(this.env));

    this.commands = getAllCommands(this.context.entities, this.context.verbs);
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
