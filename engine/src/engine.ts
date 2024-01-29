import { isInstant, Verb } from "./verb"
import { Entity } from "./entity"
import { Env } from "tift-types/src/env"
import { createRootEnv } from "./env"
import { ContextEntities, buildSearchContext, searchExact, getNextWords } from "./commandsearch"
import { OutputConsumer } from "tift-types/src/messages/output";
import * as Output from "./messages/output";
import * as MessageOut from "./builder/output";
import * as multidict from "./util/multidict";
import * as _ from "lodash";
import * as arrays from "./util/arrays";
import { PhaseAction } from "./script/phaseaction";
import { SentenceNode } from "./command";
import { InputMessage, Load } from "tift-types/src/messages/input";
import { EngineBuilder } from "./builder/enginebuilder";
import { Config } from "./config"
import * as Conf from "./config"
import { Optional } from "tift-types/src/util/optional";
import { logError } from "./util/errors";
import { History } from "tift-types/src/util/historyproxy";
import { Obj, KIND } from "./util/objects"
import * as Logger from "./util/logger";
import { Behaviour } from "./builder/behaviour"
import { AUTOLOOK } from "./builder/plugins/autolook"
import { Engine } from "tift-types/src/engine"
import { compileFunctions, compileGlobalFunction, compileStrings } from "./builder/functionbuilder";
import * as Entities from "./builder/entities";
import { EnvFn } from "./script/thunk";
import * as Properties from "./properties";

const DEFAULT_UNDO_LEVELS = 10;

const logger = Logger.getLogger("engine");

const BEFORE_GAME = "beforeGame";
const BEFORE_TURN = "beforeTurn";
const AFTER_TURN = "afterTurn";

export interface EngineState {
  getEntities : () => Entity[];
  getVerbs : () => Verb[];
}

export interface CommandContext {
  entities : ContextEntities;
  verbs : Verb[];
}

type CommandExecutor = (env : Env, context : CommandContext, command : string[]) => void;

export interface PluginActionContext {
  start? : CommandContext,
  end : CommandContext,
  env : Env,
  executor : CommandExecutor
}

export type PluginAction = (context : PluginActionContext) => void;


const BASE_CONFIG : Config = {
  undoLevels : DEFAULT_UNDO_LEVELS 
};
const BASE_PROPS = { "entities" : {}, "verbs" : {}};
const BASE_NS = [["entities"], ["verbs"]];
const BASE_CONTEXT = { entities : {}, verbs : [] }

const TYPE_NAMESPACES : {[key : string]: string}= {
  [Entities.ENTITY_KIND] : "entities",
  "rule" : "entities",
  "verb" : "verbs"
}
 

export class BasicEngine implements Engine {
  private config : Config = _.cloneDeep(BASE_CONFIG);
  private env : Env;
  private context : CommandContext;
  private output : OutputConsumer;
  private startActions : PluginAction[] = [];
  private postExecutionActions : PluginAction[] = [];
  private started = false;
  private gameData : Behaviour;

  constructor(gameData : Behaviour, outputConsumer : OutputConsumer, config? : Config) {
    this.gameData = gameData;
    this.output = outputConsumer;
    Object.assign(this.config, config);
    Logger.setConsumer(getOutputLogger(this.output));
    [this.env, this.context] = this.reset();
  }

  reset() : [Env, CommandContext] {
    this.env = createRootEnv(_.cloneDeep(BASE_PROPS), _.cloneDeep(BASE_NS));
    this.env.proxyManager.setUndoLevels(this.config.undoLevels ?? DEFAULT_UNDO_LEVELS);

    this.gameData.reset(this.env, this.output);

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

    this.gameData.start(this.env);

    this.env.proxyManager.clearHistory();

    if (saveData) {
      const data = JSON.parse(saveData) as History;
      this.env.replayHistory(data);
    }
    this.env.proxyManager.startRecording();

    this.context = this.getContext();

    // Run any plugin actions
    const actionContext = this.createPluginActionContext(undefined, this.context);
    this.startActions.forEach(action => action(actionContext));

    if (!saveData) {
      // Run any before game rules
      // but only if this is a brand new game
      const startupRules = this.env.findObjs(obj => obj[BEFORE_GAME] !== undefined)
                                .map(rule => [rule, rule[BEFORE_GAME]] as [Obj, EnvFn]);
      startupRules.forEach(([obj, rule]) => executeRule(obj, rule, this.env));
    }

    this.started = true;
  }

  setupPluginActions() {
    if (Conf.getBoolean(this.config, Conf.AUTO_LOOK)) {
      this.postExecutionActions.push(AUTOLOOK);
      this.startActions.push(AUTOLOOK);
    }
  }

  addContent(getContent : (env : Env) => Obj[]) {
    const objs = getContent(this.env);
    const props = this.env.properties;
    objs.forEach(obj => {
      const { id, type, ...properties } = obj;
      if (type === "property") {
        Properties.setProperties(this.env, id, properties);
      } else if (type === "global") {
        Object.entries(obj)
              .forEach(([key,value]) => {
                props[key] = value;
                compileGlobalFunction(key, value, this.env);
              })
      } else {
        const kind = obj[KIND] ?? type;
        const namespace = TYPE_NAMESPACES[kind];
        if (namespace) {
          props[namespace][id] = obj;
        } else {
          props[id] = obj;
        }
        compileFunctions(namespace, id, this.env);
        compileStrings(namespace, id, this.env);
      }
    });
  }



  getContext() : CommandContext {
    return this.gameData.getContext(this.env);
  }

  send(message : InputMessage) : Promise<void> {
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
        case "Undo":
          this.undo();
          break;
        case "Redo":
          this.redo();
          break;
        case "GetInfo":
          this.getInfo();
          break;
      }
    } catch (e) {
      logError(this.output, e);
    }
    logger.debug(() => `${JSON.stringify(message)}: ${Date.now() - startTime}ms`);
    return Promise.resolve();
  }

  loadData(message : Load) {
    const builder = new EngineBuilder();
    builder.fromYaml(message.data);
    this.addContent(env => builder.addToEnv(env));
  }

  save() {
    const history = this.env.proxyManager.getHistory();
    const saveState = Output.saveState(history);
    this.output(saveState);
  }

  undo() {
    this.env.proxyManager.undo();

    this.context = this.getContext();
    // Run any plugin actions
    const actionContext = this.createPluginActionContext(undefined, this.context);
    this.startActions.forEach(action => action(actionContext));

    this.getStatus();
    this.save();
  }

  redo() {
    this.env.proxyManager.redo();

    this.context = this.getContext();
    // Run any plugin actions
    const actionContext = this.createPluginActionContext(undefined, this.context);
    this.startActions.forEach(action => action(actionContext));

    this.getStatus();
    this.save();
  }

  getInfo() {
    this.output(Output.log("info", "Version: 0.0.2"));
  }

  setConfig(newConfig : Config) {
    Object.assign(this.config, newConfig);
  } 

  getWords(partial : string[]) : void {
    const nextWords = getNextWords(partial, this.context.entities, this.context.verbs, this.env);
    const message = Output.words( partial, nextWords );
    this.output(message);
  }

  execute(command: string[]): void {
    const [matchedCommand, verb] = searchCommand(this.env, this.context, command);

    const isTimePassing = verb && !isInstant(verb);
    // Run any before turn rules
    if (isTimePassing) {
      const contextualRules = this.getContextualRules(BEFORE_TURN);
      const globalRules = this.getGlobalRules(BEFORE_TURN);
      
      const allRules = [...globalRules, ...contextualRules];
      allRules.forEach(([obj, rule]) => executeRule(obj, rule, this.env));
    }

    executeActions(this.env, this.context, matchedCommand, verb)

    const oldContext = this.context;
    this.context = this.getContext();

    // Run any post execution actions
    const postExecutionContext = this.createPluginActionContext(oldContext, this.context);
    this.postExecutionActions.forEach(action => action(postExecutionContext));

    if (isTimePassing) {
      // Run afterTurn rules
      const contextualRules = this.getContextualRules(AFTER_TURN);
      const globalRules = this.getGlobalRules(AFTER_TURN);
      const allRules = [...contextualRules, ...globalRules];
      allRules.forEach(([obj, rule]) => executeRule(obj, rule, this.env));

      // push the history
      const pushed = this.env.proxyManager.pushHistory();

      // Send the current save state
      if (pushed) {
        this.save();
      }
    }
    MessageOut.flush(this.env);
  }

  getContextualRules(methodName : string) : [Obj, EnvFn][] {
      const allEntities = _.flatten(Object.values(this.context.entities))
      const contextualRules = allEntities.filter(entity => entity[methodName] != undefined)
                                         .map(entity => [entity, entity[methodName]] as [Obj, EnvFn]);
      return contextualRules;
  }

  getGlobalRules(methodName : string) : [Obj, EnvFn][] {
      const globalRules = this.env.findObjs(obj => obj["type"] === "rule")
                              .filter(rule => this.isRuleInScope(rule))
                              .filter(rule => rule[methodName] != undefined)
                              .map(rule => [rule, rule[methodName]] as [Obj, EnvFn]);
      return globalRules;
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
    const env = this.env;
    return {start, end, env, executor : commandExecutor}
  }

  getStatus() : void {
    const status = this.gameData.getStatus(this.env);
    this.output(Output.status(status, this.env.proxyManager.isUndoable(), this.env.proxyManager.isRedoable()));
  }

  getEntities() : Entity[] {
    return this.env.findObjs(obj => Entities.isEntity(obj)) as Entity[];
  }

  getVerbs() : Verb[] {
    return this.env.findObjs(obj => obj["type"] === "verb") as Verb[];
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

const commandExecutor : CommandExecutor = (env, context, command) => {
  const [matchedCommand, verb] = searchCommand(env, context, command);
  executeActions(env, context, matchedCommand, verb);
}

/**
 * Search for a command in the provided context
 */
function searchCommand(env : Env, context : CommandContext, command : string[]) : [SentenceNode, Verb?] {
  const searchContext = buildSearchContext(context.entities, context.verbs, env);
  const matchedCommand = searchExact(command, searchContext);
  if (!matchedCommand) {
    throw new Error("Could not match command: " + JSON.stringify(command));
  }
  const verb = matchedCommand.getPoS("verb")?.verb;
  return [matchedCommand, verb];
}

/**
 * execute before/main/after actions 
 */
function executeActions(env : Env, context : CommandContext, matchedCommand : SentenceNode, verb? : Verb) {
      // Get ordered list of in scope entities
      const inScopeEntities = sortEntities(context, matchedCommand);

      // Before actions
      // Get ordered list of actions.  There may be multiple actions for each entity
      const beforeActions = inScopeEntities.flatMap(entity => 
          getActions(entity.before, entity.id, matchedCommand).map(action => ({entity, action})));
      
      const handledBefore = beforeActions.some(entityAction => 
          executeAction(entityAction.action, env, matchedCommand, entityAction.entity));

      // Main action
      let handledMain = false;
      if (!handledBefore && verb) {
        const mainActions = getActions(verb.actions, verb.id, matchedCommand)
                                .map(action => ({verb, action}));
        handledMain = mainActions.some(verbAction => 
            executeAction(verbAction.action, env, matchedCommand, verbAction.verb));
      }
  
      // After actions
      if (handledMain) {
        const afterActions = inScopeEntities.flatMap(entity => 
          getActions(entity.after, entity.id, matchedCommand).map(action => ({entity, action})));
        afterActions.some(entityAction => executeAction(entityAction.action, env, matchedCommand, entityAction.entity));
      }

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
function sortEntities(context : CommandContext, matchedCommand : SentenceNode) : Entity[] {
  const allContextEntities = _.flatten(Object.values(context.entities))
  const location = getLocationFromContext(context);
  const directObject = matchedCommand.getPoS("directObject")?.entity;
  const indirectObject = matchedCommand.getPoS("indirectObject")?.entity;
  const inScopeEnitites = arrays.of(indirectObject, directObject, location);
  allContextEntities.forEach(entity => arrays.pushIfUnique(inScopeEnitites, entity, (entity1, entity2) => entity1.id === entity2.id));
  inScopeEnitites.reverse();
  return inScopeEnitites;
}

/**
 * Takes a list of actions and sorts them by score
 */
function getActions(actions : PhaseAction[], id : string, command : SentenceNode) : PhaseAction[] {
  const actionScores = actions.map(action => ({action, "score" : action.score(command, id)}));

  return actionScores.sort((a,b) => b.score - a.score)
                     .map(action => action.action);
}

function executeAction(action : PhaseAction, env : Env, command : SentenceNode, agent : Obj) : boolean {
  let handled = false;
  const result = action.perform(env, agent, command)?.getValue();
  if (result) {
    if (_.isString(result)) {
      env.execute("write", {"value":result});
    }
    handled = true;
  }
  return handled;
}

function executeRule(scope : Obj, rule : EnvFn, env : Env) {
  const entitiesEnv = env.newChild(env.createNamespaceReferences(["entities"]));
  const entityEnv = entitiesEnv.newChild(scope);
  const ruleEnv = entityEnv.newChild({"this" : scope});
  const result = rule(ruleEnv).getValue();
  if(result && _.isString(result)) {
    env.execute("write", {"value":result});
  }
}

function getLocationFromContext(context : CommandContext) : Optional<Entity> {
  return _.head(multidict.get(context.entities, "location"));
}

function getOutputLogger(output : OutputConsumer) : Logger.LogConsumer {
    return ({logger, level, message}) => {output(Output.log(level, `${level}, ${logger}: ${message}`))};
}