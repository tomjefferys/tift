import * as _ from "lodash";
import { Env } from "tift-types/src/env";
import { Optional } from "tift-types/src/util/optional";
import { isInstant, Verb } from "./verb";
import { Entity } from "./entity";
import { SentenceNode } from "./command";
import { PhaseAction } from "./script/phaseaction";
import { EnvFn } from "./script/thunk";
import { Obj } from "./util/objects";
import * as multidict from "./util/multidict";
import * as arrays from "./util/arrays";
import { buildSearchContext, searchExact } from "./commandsearch";
import type { CommandContext } from "./engine";

export const BEFORE_TURN = "beforeTurn";
export const AFTER_TURN = "afterTurn";

/**
 * Search for a command in the provided context
 */
export function searchCommand(env : Env, context : CommandContext, command : string[]) : [SentenceNode, Verb?] | undefined {
  const searchContext = buildSearchContext(context.entities, context.verbs, env);
  const matchedCommand = searchExact(command, searchContext);
  if (!matchedCommand) {
    return undefined;
  }
  const verb = matchedCommand.getPoS("verb")?.verb;
  return [matchedCommand, verb];
}

/**
 * execute before/main/after actions
 */
export function executeActions(env : Env, context : CommandContext, matchedCommand : SentenceNode, verb? : Verb) {
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

export function executeRule(scope : Obj, rule : EnvFn, env : Env) {
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

export function getContextualRules(context : CommandContext, methodName : string) : [Obj, EnvFn][] {
    const allEntities = _.flatten(Object.values(context.entities))
    const contextualRules = allEntities.filter(entity => entity[methodName] != undefined)
                                       .map(entity => [entity, entity[methodName]] as [Obj, EnvFn]);
    return contextualRules;
}

export function getGlobalRules(env : Env, context : CommandContext, methodName : string) : [Obj, EnvFn][] {
    const globalRules = env.findObjs(obj => obj["type"] === "rule")
                            .filter(rule => isRuleInScope(context, rule))
                            .filter(rule => rule[methodName] != undefined)
                            .map(rule => [rule, rule[methodName]] as [Obj, EnvFn]);
    return globalRules;
}

/**
 * Check if a rule is in scope.
 * If a rule is declared with an 'scope', check if at least one of those
 * entities is in the current context, else return true;
 * @param rule
 * @returns true if the rule is in scope or has no defined scope
 */
function isRuleInScope(context : CommandContext, rule : Obj) : boolean {
  const ruleEntities = rule["scope"];
  return _.isArray(ruleEntities)
            ? multidict.values(context.entities)
                      .map(entity => entity.id)
                      .some(entity => ruleEntities.includes(entity))
            : true;
}

/**
 * Execute a fully formed command (a list of word ids) against the given env/context.
 *
 * This resolves the words to a matching verb/entities and runs the same before/main/after
 * action resolution as a normal player turn (see BasicEngine.execute). Unlike a real turn,
 * it never throws on an unmatched command - it simply returns false - and it does not push
 * history, save, or run engine/plugin post-execution actions; those are turn-orchestration
 * concerns owned by the engine itself.
 *
 * This is intended as the execution primitive for game logic (and eventually autonomous
 * agents/NPCs) that want to run a command programmatically, having already found it via
 * some search.
 *
 * @param full also run the before-turn/after-turn rule phases around the action
 *             (default false - action only)
 * @returns true if a matching action was found and executed, false if the command
 *          did not match anything in the current context
 */
export function executeCommand(env : Env, context : CommandContext, command : string[], full = false) : boolean {
  const matched = searchCommand(env, context, command);
  if (!matched) {
    return false;
  }
  const [matchedCommand, verb] = matched;
  const isTimePassing = verb && !isInstant(verb);

  if (full && isTimePassing) {
    const allRules = [...getGlobalRules(env, context, BEFORE_TURN), ...getContextualRules(context, BEFORE_TURN)];
    allRules.forEach(([obj, rule]) => executeRule(obj, rule, env));
  }

  executeActions(env, context, matchedCommand, verb);

  if (full && isTimePassing) {
    const allRules = [...getContextualRules(context, AFTER_TURN), ...getGlobalRules(env, context, AFTER_TURN)];
    allRules.forEach(([obj, rule]) => executeRule(obj, rule, env));
  }

  return true;
}
