import { isInstant, Verb } from "./verb"
import { Entity, hasTag, RuleFn } from "./entity"
import { Env } from "tift-types/src/env"
import { createRootEnv } from "./env"
import { ContextEntities, buildSearchContext, searchExact, getNextWords } from "./commandsearch"
import { makePlayer, makeDefaultFunctions, getPlayer, makeOutputConsumer, getOutput, LOOK_FN, write, getLocationEntity, isEntity, findEntites, isAtLocation, PLAYER } from "./builder/enginedefault";
import { OutputConsumer, OutputMessage } from "tift-types/src/messages/output";
import * as Output from "./messages/output";
import { MultiDict } from "./util/multidict";
import * as multidict from "./util/multidict";
import * as _ from "lodash";
import * as arrays from "./util/arrays";
import { addLibraryFunctions } from "./builder/library";
import { getName, Nameable } from "./nameable";
import { getBestMatchAction, PhaseAction } from "./script/phaseaction";
import { SentenceNode } from "./command";
import { InputMessage, Load } from "tift-types/src/messages/input";
import { EngineBuilder } from "./builder/enginebuilder";
import { Config } from "./config"
import * as Conf from "./config"
import { bold } from "./markdown"
import { Optional } from "tift-types/src/util/optional";
import { logError } from "./util/errors";
import { Action } from "./util/historyproxy";
import { Obj } from "./util/objects"
import * as Logger from "./util/logger";

const logger = Logger.getLogger("engine");

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
}

type PluginAction = (context : PluginActionContext) => void;

const BASE_CONFIG : Config = {};
const BASE_PROPS = { "entities" : {}, "verbs" : {}};
const BASE_NS = [["entities"], ["verbs"]];
const BASE_CONTEXT = { entities : {}, verbs : [] }
 

export class BasicEngine implements Engine {
  private config : Config = BASE_CONFIG;
  private env : Env;
  private context : CommandContext;
  private output : OutputConsumer;
  private startActions : PluginAction[] = [];
  private postExecutionActions : PluginAction[] = [];
  private started = false;

  constructor(outputConsumer : OutputConsumer) {
    this.output = outputConsumer;
    Logger.setConsumer(getOutputLogger(this.output));
    [this.env, this.context] = this.reset();
  }

  reset() : [Env, CommandContext] {
    this.config = _.cloneDeep(BASE_CONFIG);
    this.env = createRootEnv(_.cloneDeep(BASE_PROPS), _.cloneDeep(BASE_NS));
    const rootProps = this.env.properties;

    makeDefaultFunctions(rootProps);
    makeOutputConsumer(rootProps, this.output);
    addLibraryFunctions(rootProps);

    this.context = _.cloneDeep(BASE_CONTEXT)

    this.startActions.length = 0;
    this.postExecutionActions.length = 0;
    this.started = false;

    return [this.env, this.context];
  }

  start(saveData? : string) {
    if (this.started) {
      throw new Error("Engine is already started");
    }
    this.setupPluginActions();
    const rootProps = this.env.properties;
    const start = findStartingLocation(this.env);
    makePlayer(rootProps, start);

    this.env.proxyManager.clearHistory();
    this.env.proxyManager.startRecording();

    if (saveData) {
      const data = JSON.parse(saveData) as Action[];
      this.env.replayHistory(data);
    }

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
    const props = this.env.properties;
    // These need adding to the readonly root Env
    objs.forEach(obj => props[obj.id as string] = obj); // FIXME reject anything without an id
    entities.forEach(entity => props["entities"][entity.id] = entity);
    verbs.forEach(verb => props["verbs"][verb.id] = verb);
  }

  getContext() : CommandContext {
    const contextEntities : MultiDict<Entity> = {};

    // Entity for the current location
    const locationEntity = getLocationEntity(this.env);

    if (locationEntity) {
      multidict.add(contextEntities, "location", locationEntity);
    }

    // Get any other entities that are here
    findEntites(this.env, locationEntity)
        .filter(entity => !isAtLocation(this.env, PLAYER, entity))
        .forEach(entity => multidict.add(contextEntities, "environment", entity));

    // Get inventory entities
    this.env.findObjs(obj => obj?.location === "__INVENTORY__" && isEntity(obj))
            .forEach(entity => multidict.add(contextEntities, "inventory", entity));

    // Get worn entities
    this.env.findObjs(obj => obj?.location === "__WEARING__" && isEntity(obj))
            .forEach(entity => multidict.add(contextEntities, "wearing", entity));

    const verbs  = this.env.findObjs(obj => obj?.type === "verb") as Verb[];

    logger.debug(() => multidict.values(contextEntities).map(entity => entity.id).join(","));
  
    return {
      entities: contextEntities,
      verbs: verbs
    }
  }

  send(message : InputMessage) : void {
    const startTime = Date.now();
    try { 
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
          this.start(message.saveData);
          break;
        case "Config":
          this.setConfig(message.properties);
          break;
        case "Reset":
          this.reset();
          break;
      }
    } catch (e) {
      logError(this.output, e);
    }
    logger.debug(() => `${JSON.stringify(message)}: ${Date.now() - startTime}ms`);
  }

  loadData(message : Load) {
    const builder = new EngineBuilder();
    builder.fromYaml(message.data);
    this.addContent(builder.entities, builder.verbs, builder.objs);
  }

  save() {
    const history = this.env.proxyManager.getHistory();
    const saveState = Output.saveState(history);
    this.output(saveState);
  }

  setConfig(newConfig : Config) {
    Object.assign(this.config, newConfig);
  } 

  getWords(partial : string[]) : void {
    const nextWords = getNextWords(partial, this.context.entities, this.context.verbs, this.env);
    const message = Output.words( partial, nextWords.map(word => ({...word, type : "word"})));
    this.output(message);
  }

  execute(command: string[]): void {
    const searchContext = buildSearchContext(this.context.entities, this.context.verbs, this.env);
    const matchedCommand = searchExact(command, searchContext);
    if (!matchedCommand) {
      throw new Error("Could not match command: " + JSON.stringify(command));
    }

    // Get ordered list of in scope entities
    const inScopeEnitites = this.sortEntities(matchedCommand);

    // Create a new child environment with it's own output conusmer
    const [childEnv, mainOutputProxy] = this.createOutputProxy();

    // Before actions
    const handledBefore = inScopeEnitites.some(entity => executeBestMatchAction(entity.before, childEnv, matchedCommand, entity) )

    // Main action
    const verb = matchedCommand.getPoS("verb")?.verb;
    const handledMain = (!handledBefore && verb) ? executeBestMatchAction(verb.actions, childEnv, matchedCommand, verb) : false;

    // After actions
    const [afterChildEnv, afterOutputProxy] = this.createOutputProxy();
    if (handledMain) {
      inScopeEnitites.some(entity => executeBestMatchAction(entity.after, afterChildEnv, matchedCommand, entity));
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

    if (verb && !isInstant(verb)) {
      // Run any contextual rules
      const allEntities = _.flatten(Object.values(this.context.entities))
      const contextualRules = allEntities.flatMap(entity => entity.rules.map(rule => [entity, rule] as [Entity,RuleFn]));
      contextualRules.forEach(([entity,rule]) => executeRule(entity, rule, this.env));

      // Find and execute any global rules
      const globalRules = this.env.findObjs(obj => obj["type"] === "rule");
      globalRules.filter(rule => this.isRuleInScope(rule))
                 .forEach(rule => executeRule(rule, rule["__COMPILED__"], this.env));
    }

    // Send the current save state
    this.save(); // TODO use a proxy to detect if anything has changed? (Use a counter, and increment it for every state change)
  }

  /**
   * Arrange entities in the following execution order
   * 1. Scope/Context
   * 2. Room
   * 3. Object being acted on
   * 4. The indirect object 
   * 
   * @param matchedCommand 
   * @returns 
   */
  sortEntities(matchedCommand : SentenceNode) : Entity[] {
    const allContextEntities = _.flatten(Object.values(this.context.entities))
    const location = getLocationFromContext(this.context);
    const directObject = matchedCommand.getPoS("directObject")?.entity;
    const indirectObject = matchedCommand.getPoS("indirectObject")?.entity;
    const inScopeEnitites = arrays.of(indirectObject, directObject, location);
    allContextEntities.forEach(entity => arrays.pushIfUnique(inScopeEnitites, entity, (entity1, entity2) => entity1.id === entity2.id));
    inScopeEnitites.reverse();
    return inScopeEnitites;
  }

  createPluginActionContext(start : Optional<CommandContext>, end : CommandContext) : PluginActionContext {
    return {
      start : start,
      end : end,
      env : this.env
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

  /**
   * Check if a rule is in scope.
   * If a rule is declared with an 'scope', check if at least one of those
   * entities is in the current context, else return true;
   * @param rule 
   * @returns true if the rule is in scope or has no defined scope
   */
  isRuleInScope(rule : Obj) {
    const ruleEntities = rule["scope"];
    return _.isArray(ruleEntities)
              ? multidict.values(this.context.entities)
                        .map(entity => entity.id)
                        .some(entity => ruleEntities.includes(entity))
              : true; 
  }
}

const AUTOLOOK : PluginAction = (context : PluginActionContext) => {
  const oldLocation = (context.start) ? getLocationFromContext(context.start) : undefined;
  const newLocation = getLocationFromContext(context.end);
  if (newLocation && oldLocation?.id !== newLocation.id) {
    const player = getPlayer(context.env);
    write(context.env, bold(getName(newLocation)));

    const visititedLocations = player["visitedLocations"] as string[];

    if (!visititedLocations.includes(newLocation.id)) {
      visititedLocations.push(newLocation.id);
      LOOK_FN(context.env);
    }
  } 
}

function executeBestMatchAction(actions : PhaseAction[], env : Env, command : SentenceNode, agent : Obj ) {
  const action = getBestMatchAction(actions, command, agent.id); // FIXME getBestMatchAction, and action.perform have params in different orders
  let handled = false;
  if (action) {
    const result = action.perform(env, agent, command)?.getValue();
    if (result) {
      if (_.isString(result)) {
        env.execute("write", {"value":result});
      }
      handled = true;
    }
  }
  return handled;
}

function executeRule(scope : Obj, rule : RuleFn, env : Env) {
  const entitiesEnv = env.newChild(env.createNamespaceReferences(["entities"]));
  const ruleEnv = entitiesEnv.newChild({"this" : scope});
  const result = rule(ruleEnv);
  if(result && _.isString(result)) {
    env.execute("write", {"value":result});
  }
}

function findStartingLocation(env : Env) : string {
  const startingLocs = env.findObjs(obj => obj["type"] === TYPE.ROOM && hasTag(obj, TAG.START));
  if (startingLocs.length == 0) {
    throw new Error("No starting location defined");
  }
  if (startingLocs.length > 1) {
    throw new Error("Multiple starting locations found");
  }
  return startingLocs[0].id;
}

function getLocationFromContext(context : CommandContext) : Optional<Entity> {
  return _.head(multidict.get(context.entities, "location"));
}

function getOutputLogger(output : OutputConsumer) : Logger.LogConsumer {
    return ({logger, level, message}) => {output(Output.log(level, `${level}, ${logger}: ${message}`))};
}
