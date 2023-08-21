import { isInstant, Verb } from "./verb"
import { Entity } from "./entity"
import { Env } from "tift-types/src/env"
import { createRootEnv } from "./env"
import { ContextEntities, buildSearchContext, searchExact, getNextWords } from "./commandsearch"
import { OutputConsumer, OutputMessage } from "tift-types/src/messages/output";
import * as Output from "./messages/output";
import * as multidict from "./util/multidict";
import * as _ from "lodash";
import * as arrays from "./util/arrays";
import { getBestMatchAction, PhaseAction } from "./script/phaseaction";
import { SentenceNode } from "./command";
import { InputMessage, Load } from "tift-types/src/messages/input";
import { EngineBuilder } from "./builder/enginebuilder";
import { Config } from "./config"
import * as Conf from "./config"
import { Optional } from "tift-types/src/util/optional";
import { logError } from "./util/errors";
import { History } from "tift-types/src/util/historyproxy";
import { Obj } from "./util/objects"
import * as Logger from "./util/logger";
import { Behaviour } from "./builder/behaviour"
import { AUTOLOOK } from "./builder/plugins/autolook"
import { Engine } from "tift-types/src/engine"
import { compileFunctions, compileStrings } from "./builder/functionbuilder";
import { ENTITY_TYPE } from "./builder/entities"
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

interface OutputProxy {
  flush : () => void;
  hasContent : () => boolean;
}

export interface PluginActionContext {
  start? : CommandContext,
  end : CommandContext,
  env : Env,
}

export type PluginAction = (context : PluginActionContext) => void;

const BASE_CONFIG : Config = {
  undoLevels : DEFAULT_UNDO_LEVELS 
};
const BASE_PROPS = { "entities" : {}, "verbs" : {}};
const BASE_NS = [["entities"], ["verbs"]];
const BASE_CONTEXT = { entities : {}, verbs : [] }

const TYPE_NAMESPACES : {[key : string]: string}= {
  [ENTITY_TYPE] : "entities",
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
      } else {
        const namespace = TYPE_NAMESPACES[type];
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
        case "Undo":
          this.undo();
          break;
        case "Redo":
          this.redo();
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

  setConfig(newConfig : Config) {
    Object.assign(this.config, newConfig);
  } 

  getWords(partial : string[]) : void {
    const nextWords = getNextWords(partial, this.context.entities, this.context.verbs, this.env);
    const message = Output.words( partial, nextWords );
    this.output(message);
  }

  execute(command: string[]): void {
    const searchContext = buildSearchContext(this.context.entities, this.context.verbs, this.env);
    const matchedCommand = searchExact(command, searchContext);
    if (!matchedCommand) {
      throw new Error("Could not match command: " + JSON.stringify(command));
    }
    const verb = matchedCommand.getPoS("verb")?.verb;
    const isTimePassing = verb && !isInstant(verb);
    // Run any before turn rules
    if (isTimePassing) {
      const contextualRules = this.getContextualRules(BEFORE_TURN);
      const globalRules = this.getGlobalRules(BEFORE_TURN);
      
      const allRules = [...globalRules, ...contextualRules];
      allRules.forEach(([obj, rule]) => executeRule(obj, rule, this.env));
    }

    // Get ordered list of in scope entities
    const inScopeEnitites = this.sortEntities(matchedCommand);

    // Create a new child environment with it's own output conusmer
    const [childEnv, mainOutputProxy] = this.createOutputProxy();

    // Before actions
    const handledBefore = inScopeEnitites.some(entity => executeBestMatchAction(entity.before, childEnv, matchedCommand, entity) )

    // Main action
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
    return {
      start : start,
      end : end,
      env : this.env
    }
  }

  getStatus() : void {
    const status = this.gameData.getStatus(this.env);
    this.output(Output.status(status, this.env.proxyManager.isUndoable(), this.env.proxyManager.isRedoable()));
  }

  getEntities() : Entity[] {
    return this.env.findObjs(obj => obj["type"] === ENTITY_TYPE) as Entity[];
  }

  getVerbs() : Verb[] {
    return this.env.findObjs(obj => obj["type"] === "verb") as Verb[];
  }

  createOutputProxy() : [Env, OutputProxy] {
    const messages : OutputMessage[] = [];
    const childEnvObj = {};
    this.gameData.makeOutputConsumer(childEnvObj, message => messages.push(message));
    const childEnv = this.env.newChild(childEnvObj);
    const principalOutput = this.gameData.getOutput(this.env);
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