import { Verb } from "./verb"
import { Entity, getType, hasTag } from "./entity"
import { createRootEnv, Obj } from "./env"
import { ContextEntities, buildSearchContext, searchExact, getNextWords } from "./commandsearch"
import { makePlayer, makeDefaultFunctions, getPlayer, makeOutputConsumer } from "./enginedefault";
import { OutputConsumer } from "./messages/output";
import { IdValue } from "./shared";
import { MultiDict } from "./util/multidict";
import * as multidict from "./util/multidict";
import * as _ from "lodash";
import * as arrays from "./util/arrays";
import { addLibraryFunctions } from "./script/library";
import { getName, Nameable } from "./nameable";
import { getBestMatchAction } from "./script/phaseaction";

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
  getEntities : () => Entity[];
  getVerbs : () => Verb[];
}

interface CommandContext {
  entities : ContextEntities;
  verbs : Verb[];
}

export class BasicEngine implements Engine {
  private readonly env;
  private context : CommandContext;

  constructor(entities : Entity[], verbs : Verb[], outputConsumer : OutputConsumer, objs : Obj[]) {
    const envEntities = {} as Obj;
    const envVerbs = {} as Obj;
    const environment = {} as Obj; 
    objs.forEach(obj => environment[obj.id as string] = obj); // FIXME reject anything without an id
    entities.forEach(entity => envEntities[entity.id] = entity);
    verbs.forEach(verb => envVerbs[verb.id] = verb);

    environment.entities = envEntities;
    environment.verbs = envVerbs;

    const start = findStartingLocation(entities);
    makePlayer(environment, start);
    makeDefaultFunctions(environment);
    makeOutputConsumer(environment, outputConsumer);
    addLibraryFunctions(environment);

    const rootEnv = createRootEnv(environment, "readonly", [["entities"], ["verbs"]]);
    this.env = rootEnv.newChild();

    this.context = this.getContext();
  }

  getContext() : CommandContext {
    // Entity for the current location
    const contextEntities : MultiDict<Entity> = {};
    const location = getPlayer(this.env).location;
    const locationEntity = this.env.findObjs(obj => obj?.id === location);
    if (locationEntity.length) {
      multidict.add(contextEntities, "location", locationEntity[0]);
    }

    // Get any other entities that are here
    this.env.findObjs(obj => obj?.location === location) // Also check it is an entity
            .forEach(entity => multidict.add(contextEntities, "environment", entity));

    // Get inventory entities
    this.env.findObjs(obj => obj?.location === "INVENTORY") // Also check it is an entity
            .forEach(entity => multidict.add(contextEntities, "inventory", entity));

    const verbs  = this.env.findObjs(obj => obj?.type === "verb") as Verb[];
  
    return {
      entities: contextEntities,
      verbs: verbs
    }
  }

  getWords(partial : string[]): IdValue<string>[] {
    return getNextWords(partial, this.context.entities, this.context.verbs);
  }
  
  execute(command: string[]): void {
    const allContextEntities = _.flatten(Object.values(this.context.entities))

    const searchContext = buildSearchContext(this.context.entities, this.context.verbs);
    const matchedCommand = searchExact(command, searchContext);
    if (!matchedCommand) {
      throw new Error("Could not match command: " + JSON.stringify(command));
    }

    // Inform has the following order for actions
    // 1. Scope/Context
    // 2. Room
    // 3. Object being acted on
    const location = _.head(multidict.get(this.context.entities, "location"));
    const directObject = matchedCommand.getPoS("directObject")?.entity;
    const indirectObject = matchedCommand.getPoS("indirectObject")?.entity;
    const inScopeEnitites = arrays.of(indirectObject, directObject, location);
    allContextEntities.forEach(entity => arrays.pushIfUnique(inScopeEnitites, entity, (entity1, entity2) => entity1.id === entity2.id));
    inScopeEnitites.reverse();

    let handled = false;
    for(const entity of inScopeEnitites) {
      const action = getBestMatchAction(entity.before, matchedCommand);
      if (action) {
        const result = action.perform(this.env, matchedCommand);
        if (result) {
          if (_.isString(result)) {
            // Output the string
          }
          handled = true;
          break;
        }
      }
    }

    if (!handled) {
      const verb = matchedCommand.getPoS("verb")?.verb;
      const actionSources = [location, verb]; // TODO should all main actions be stored as verbs?
      for (const actionSource of actionSources) {
        const action = getBestMatchAction(actionSource?.actions ?? [], matchedCommand);
        if (action) {
          action.perform(this.env, matchedCommand);
          break;
        }
      }
    }

    // TODO after actions

    this.context = this.getContext();

    // Find and execute any rules
    const rules = this.env.findObjs(obj => obj["type"] === "rule");
    const expressions = rules.flatMap(rules => rules["__COMPILED__"]);
    expressions.forEach(expr => expr(this.env));
  }

 
  getStatus() : string {
    const playerLocation = getPlayer(this.env).location
    const locations = this.env.findObjs(obj => obj?.id === playerLocation) as Nameable[];
    if (!locations.length) {
      throw new Error("Could not find player location");
    }
    return getName(locations[0]);
  }

  getEntities() : Entity[] {
    return this.env.findObjs(obj => obj["type"] === "room" || obj["type"] === "object" || obj["type"] === "item") as Entity[];
  }

  getVerbs() : Verb[] {
    return this.env.findObjs(obj => obj["type"] === "verb") as Verb[];
  }
}

function findStartingLocation(entities : Entity[]) : string {
  const startingLocs = entities.filter(
      entity => getType(entity) === TYPE.ROOM && hasTag(entity, TAG.START));
  if (startingLocs.length == 0) {
    throw new Error("No starting location defined");
  }
  if (startingLocs.length > 1) {
    throw new Error("Multiple starting locations found");
  }
  return startingLocs[0].id;
}
