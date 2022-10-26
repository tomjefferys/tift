import { isInstant, Verb } from "./verb"
import { Entity, getType, hasTag } from "./entity"
import { createRootEnv, Env, Obj } from "./env"
import { ContextEntities, buildSearchContext, searchExact, getNextWords } from "./commandsearch"
import { makePlayer, makeDefaultFunctions, getPlayer, makeOutputConsumer, getOutput, PLAYER } from "./enginedefault";
import { OutputConsumer, OutputMessage } from "./messages/output";
import * as Output from "./messages/output";
import { MultiDict } from "./util/multidict";
import * as multidict from "./util/multidict";
import * as _ from "lodash";
import * as arrays from "./util/arrays";
import { addLibraryFunctions } from "./script/library";
import { getName, Nameable } from "./nameable";
import { getBestMatchAction, PhaseAction } from "./script/phaseaction";
import { Command, SentenceNode } from "./command";
import { InputMessage, Load } from "./messages/input";
import { EngineBuilder } from "./enginebuilder";
import { makePath } from "./path";
import { Config } from "./config"
import * as Conf from "./config"
import { bold } from "./markdown"
import { Optional } from "./util/optional";

enum TAG {
  START = "start"
}

enum TYPE {
  ROOM = "room"
}

export interface Engine {
  send(message : InputMessage) : void;
}

export interface EngineState {
  getEntities : () => Entity[];
  getVerbs : () => Verb[];
}

interface CommandContext {
  entities : ContextEntities;
  verbs : Verb[];
}

interface OutputProxy {
  flush : () => void;
  hasContent : () => boolean;
}

interface PluginActionContext {
  start? : CommandContext,
  end : CommandContext,
  env : Env,
  output : OutputConsumer,
  execute : (command : string[]) => void
}

type PluginAction = (context : PluginActionContext) => void;

export class BasicEngine implements Engine {
  private readonly config : Config = {};
  private readonly rootEnv : Env;
  private readonly env : Env;
  private context : CommandContext;
  private output : OutputConsumer;
  private startActions : PluginAction[] = [];
  private postExecutionActions : PluginAction[] = [];
  private started = false;

  constructor(entities : Entity[], verbs : Verb[], outputConsumer : OutputConsumer, objs : Obj[]) {
    this.rootEnv = createRootEnv({ "entities" : {}, "verbs" : {}}, "readonly", [["entities"], ["verbs"]]);
    this.addContent(entities, verbs, objs);

    const rootProps = this.rootEnv.properties;

    makeDefaultFunctions(rootProps);
    makeOutputConsumer(rootProps, outputConsumer);
    addLibraryFunctions(rootProps);

    this.output = outputConsumer;

    this.env = this.rootEnv.newChild();

    this.context = {
      entities : {},
      verbs : []
    }
  }

  start() {
    if (this.started) {
      throw new Error("Engine is already started");
    }
    this.setupPluginActions();
    const rootProps = this.rootEnv.properties;
    const start = findStartingLocation(_.values(rootProps["entities"]));
    makePlayer(rootProps, start);
    this.context = this.getContext();

    // Run any plugin actions
    const actionContext = this.createPluginActionContext(undefined, this.context);
    this.startActions.forEach(action => action(actionContext));

    this.started = true;
  }

  setupPluginActions() {
    if (Conf.getBoolean(this.config, Conf.AUTO_LOOK)) {
      this.postExecutionActions.push(AUTOLOOK);
      this.startActions.push(AUTOLOOK);
    }
  }

  addContent(entities : Entity[], verbs : Verb[], objs : Obj[]) {
    const props = this.rootEnv.properties;
    // These need adding to the readonly root Env
    objs.forEach(obj => props[obj.id as string] = obj); // FIXME reject anything without an id
    entities.forEach(entity => props["entities"][entity.id] = entity);
    verbs.forEach(verb => props["verbs"][verb.id] = verb);
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

  send(message : InputMessage) : void {
      switch(message.type) {
        case "GetWords":
          this.getWords(message.command);
          break;
        case "GetStatus":
          this.getStatus();
          break;
        case "Execute":
          this.execute(message.command);
          break;
        case "Load": 
          this.loadData(message);
          break;
        case "Start":
          this.start();
          break;
        case "Config":
          this.setConfig(message.properties);
          break;
      }
  }

  loadData(message : Load) {
    const builder = new EngineBuilder();
    builder.fromYaml(message.data);
    this.addContent(builder.entities, builder.verbs, builder.objs);
  }

  setConfig(newConfig : Config) {
    Object.assign(this.config, newConfig);
  } 

  getWords(partial : string[]) : void {
    const nextWords = getNextWords(partial, this.context.entities, this.context.verbs);
    const message = Output.words( partial, nextWords);
    this.output(message);
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
    const location = getLocation(this.context);
    const directObject = matchedCommand.getPoS("directObject")?.entity;
    const indirectObject = matchedCommand.getPoS("indirectObject")?.entity;
    const inScopeEnitites = arrays.of(indirectObject, directObject, location);
    allContextEntities.forEach(entity => arrays.pushIfUnique(inScopeEnitites, entity, (entity1, entity2) => entity1.id === entity2.id));
    inScopeEnitites.reverse();

    // Create a new child environment with it's own output conusmer
    const [childEnv, mainOutputProxy] = this.createOutputProxy();

    // Before actions
    let handledBefore = false;
    for(const entity of inScopeEnitites) {
      handledBefore = executeBestMatchAction(entity.before, childEnv, matchedCommand, entity.id);
      if (handledBefore) {
        break;
      }
    }

    // Main actions
    let handledMain = false;
    const verb = matchedCommand.getPoS("verb")?.verb;
    if (!handledBefore && verb) {
      handledMain = executeBestMatchAction(verb.actions, childEnv, matchedCommand, verb.id);
    }

    // After actions
    const [afterChildEnv, afterOutputProxy] = this.createOutputProxy();
    if (handledMain) {
      let handledAfter = false;
      for(const entity of inScopeEnitites) {
        handledAfter = executeBestMatchAction(entity.after, afterChildEnv, matchedCommand, entity.id);
        if (handledAfter) {
          break;
        }
      }
    }

    // Flush the output
    if (afterOutputProxy.hasContent()) {
      afterOutputProxy.flush();
    } else {
      mainOutputProxy.flush();
    }

    const oldContext = this.context;
    this.context = this.getContext();

    // Run any post execution actions
    const postExecutionContext = this.createPluginActionContext(oldContext, this.context);
    this.postExecutionActions.forEach(action => action(postExecutionContext));

    // Find and execute any rules
    if (verb && !isInstant(verb)) {
      const rules = this.env.findObjs(obj => obj["type"] === "rule");
      const expressions = rules.flatMap(rules => rules["__COMPILED__"]);
      expressions.forEach(expr => expr(this.env));
    }
  }

  createPluginActionContext(start : Optional<CommandContext>, end : CommandContext) : PluginActionContext {
    return {
      start : start,
      end : end,
      env : this.env,
      output : this.output,
      execute : (command : string[]) => this.execute(command)
    }
  }

 
  getStatus() : void {
    const playerLocation = getPlayer(this.env).location
    const locations = this.env.findObjs(obj => obj?.id === playerLocation) as Nameable[];
    if (!locations.length) {
      throw new Error("Could not find player location");
    }
    const status = getName(locations[0]);
    this.output(Output.status(status));
  }

  getEntities() : Entity[] {
    return this.env.findObjs(obj => obj["type"] === "room" || obj["type"] === "object" || obj["type"] === "item") as Entity[];
  }

  getVerbs() : Verb[] {
    return this.env.findObjs(obj => obj["type"] === "verb") as Verb[];
  }

  createOutputProxy() : [Env, OutputProxy] {
    const messages : OutputMessage[] = [];
    const childEnvObj = {};
    makeOutputConsumer(childEnvObj, message => messages.push(message));
    const childEnv = this.env.newChild(childEnvObj);
    const principalOutput = getOutput(this.env);
    const outputProxy = {
      flush : () => messages.forEach(message => principalOutput(message)),
      hasContent : () => messages.length > 0
    }
    return [childEnv, outputProxy];
  }
}

const AUTOLOOK : PluginAction = (context : PluginActionContext) => {
  const oldLocation = (context.start) ? getLocation(context.start) : undefined;
  const newLocation = getLocation(context.end);
  if (newLocation && oldLocation?.id !== newLocation.id) {
    const player = getPlayer(context.env);
    context.output(Output.print(bold(getName(newLocation))));

    if (!player.visitedLocations.includes(newLocation.id)) {
      const locations = player.visitedLocations;
      locations.push(newLocation.id);
      context.env.set(makePath([PLAYER, "visitedLocations"]), locations);
      context.execute(["look"]);
    }
  } 
}

function executeBestMatchAction(actions : PhaseAction[], env : Env, command : SentenceNode, agentId : string ) {
  const action = getBestMatchAction(actions, command, agentId); // FIXME getBestMatchAction, and action.perform have params in different orders
  let handled = false;
  if (action) {
    const result = action.perform(env, agentId, command)?.getValue();
    if (result) {
      if (_.isString(result)) {
        env.execute("write", {"value":result});
      }
      handled = true;
    }
  }
  return handled;
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

function getLocation(context : CommandContext) : Optional<Entity> {
  return _.head(multidict.get(context.entities, "location"));
}