import { isIntransitive, isTransitive, Verb, VerbContext } from "./verb"
import { VerbMap } from "./types"
import { Entity, VerbMatcher } from "./entity"
import { MultiDict } from "./util/multidict"
import * as _ from "lodash"
import * as multidict from "./util/multidict"
import * as Tree from "./util/tree"
import * as Arrays from "./util/arrays"
import { castDirectable, castIndirectable, castModifiable, castPreopositional, Command, start, castVerbable, DirectObject } from "./command"
import { Env } from "tift-types/src/env"
import * as Logger from "./util/logger"
import { PartOfSpeech, Word } from "tift-types/src/messages/output"
import * as SearchTerm from "./searchterm";

// verb                                -- intransitive verb
// verb object                         -- transitive verb
// verb object (with) object           -- transitive verb with attribute
// verb direction                      -- intransitive verb with qualifier
// verb object (to) direction          -- transitive verb with qualifier
// verb object direction (with) object -- transitive verb with qual and attr

type SearchFn = (context: SearchContext, state: Command) => Command[]; 
type SearchNode = Tree.ValueNode<SearchFn>;
type SearchResult = [Command, SearchNode];

type SearchTerm = SearchTerm.SearchTerm;

export type ContextEntities = MultiDict<Entity>;


const INITIAL_STATE : Command = start();

const logger = Logger.getLogger("commandsearch");

export function getAllCommands(objs: ContextEntities, verbs: Verb[], env : Env) : PartOfSpeech[][] {
  const context = buildSearchContext(objs, verbs, env);
  return searchAll(context)
          .filter(state => state.isValid())
          .map(state => state.getWords());
}

export function getNextWords(partial : string[], objs : ContextEntities, verbs : Verb[], env : Env) : Word[] {
  const context = buildSearchContext(objs, verbs, env);
  const searchTerms = [...SearchTerm.fromStrings(...partial), SearchTerm.WILD_CARD]
  const nextWords = search(searchTerms, context)
          .map(state => _.last(state.getWords()))
          .filter(Boolean)
          .map(word => word as Word);
  return _.uniqBy(nextWords, word => word.id);  // TODO: do we still need to do this?
}


export interface SearchContext {
  objs:  ContextEntities,
  verbs: VerbMap,
  env : Env
}

export function buildSearchContext(objs : ContextEntities,
                                   verbs : Verb[],
                                   env : Env) : SearchContext {
  return {
    objs,
    verbs: verbs.reduce((map,verb) => {
             map[verb.id] = verb;
             return map;
          }, {} as VerbMap),
    env
  };
}

function isVerbEnabled(context : SearchContext, entity : Entity, verbMatcher : VerbMatcher) : boolean {
  let enabled = true;
  if (verbMatcher.condition) {
    const entitiesEnv = context.env.newChild(context.env.createNamespaceReferences(["entities"]));
    const entityEnv = entitiesEnv.newChild(entity);
    const thisEnv = entityEnv.newChild({"this" : entity});
    enabled = Boolean(verbMatcher.condition.resolve(thisEnv).getValue());
  }

  return enabled;
}

/**
 * Return all direct object in the context matching a single verb
 */
function getDirectObjects(context : SearchContext, verb : Verb) : Entity[] {
  const directContexts = verb.contexts.filter(([type, _context]) => type === "direct")
                                        .map(([_type, context]) => context);
  const entities = filterEntities(context.objs, directContexts);
  return entities.filter(entity => entity.verbs.filter(verbMatcher => isVerbEnabled(context, entity, verbMatcher))
                                               .some((verbMatcher) => verbMatcher.verb === verb.id && !verbMatcher.attribute)); }

function filterEntities(entities : ContextEntities, verbContexts : string[]) {
  return verbContexts.length
            ? verbContexts.flatMap(context => entities[context] ?? [])
            : Object.values(entities).flatMap(entity => entity);
}

/**
 * Return all indirect objects in the context for a single verb
 */
function getIndirectObjects(context : SearchContext,
                            verb : Verb,
                            attribute? : string) : Entity[] {
  const indirectContexts = verb.contexts.filter(([type, _context]) => type === "indirect")
                                        .map(([_type, context]) => context);
  const entities = filterEntities(context.objs, indirectContexts);
  return entities
               .filter(obj =>
                  obj.verbs.some(matcher =>
                        testAttributeMatches(matcher, verb, attribute)));
}

/**
 * Test if a verb matcher,  matches a verb and attribute
 */
function testAttributeMatches(
          matcher : VerbMatcher,
          verb : Verb, 
          attribute? : string) : boolean {
  return matcher.verb == verb.id &&
         verb.attributes.some(verbAttribute => 
              (!attribute || verbAttribute === attribute) &&
              (verbAttribute === matcher.attribute))
                              
}

/**
 * Return all verb attributes available in a context matching a single verb
 */
function getVerbAttributes(context : SearchContext, verb : Verb) : string[] {
  const objs = getIndirectObjects(context, verb);
  return objs.flatMap(entity => 
                entity.verbs.filter(verbMatcher => verbMatcher.verb === verb.id)
                            .filter(verbMatcher => isVerbEnabled(context, entity, verbMatcher)))
             .filter(verbMatcher => verbMatcher.attribute)
             .map(verbMatcher => verbMatcher.attribute as string);
}

/**
 * Verb modifiers are things like directions added on to a verb
 * eg "go north" or "push box east"
 * Could have multiple modifiers eg
 * "go north quietly"
 * @param context  
 * @param verb 
 * @returns A list of modifiers for a particular verb (or should it be a map)
 */
const getVerbModifiers = (context : SearchContext, verb : Verb) =>
   verb.modifiers.reduce(
      (modMap : MultiDict<string>, modifier) => 
          multidict.addUnique(modMap, modifier, getModifierValues(context, modifier, verb.contexts))
      , {});

const getModifierValues = (context : SearchContext, modifier : string, verbContexts : VerbContext[]) : string[] => {
    const allContexts = verbContexts.map(([_type, context]) => context);
    const entities = filterEntities(context.objs, allContexts);
      return entities
              .flatMap(obj => obj.verbModifiers ? multidict.get(obj.verbModifiers, modifier) : []);
}

/**
 * Creates a search function to match verbs up with entities
 * @param filter a filter for the results, eg only transitve verbs
 * @returns the Search Function
 */
const getVerbSearch = (filter: (verb: Verb) => boolean) : SearchFn => {
  return (context, state) => {
    const states : Command[] = [];
    for(const [verbContext, entities] of Object.entries(context.objs)) {
      getVerbs(context, entities, context.verbs, verbContext)
        .filter(filter)
        .map(v => castVerbable(state).verb(v))
        .forEach(state => states.push(state));
    }
    logger.trace(() => `verb search ${state} = [${states.join(",")}]`);
    return states;
  }
}

/**
 * Search entities for matching verbs, discarding any verb attribute matchers, and verbs not in the context
 * @param entities a list of entities 
 * @param verbs a list of verbs
 * @param context the verb-context to limit the search to
 * @returns a list of matching verbs
 */
const getVerbs = (context : SearchContext, entities : Entity[], verbs : VerbMap, verbContext : string) : Verb[] => {
    const allVerbs = entities.flatMap(entity => (entity.verbs.map(verb => [entity, verb]) ?? []) as [Entity, VerbMatcher][])
            .filter(([_entity, matcher]) => !matcher.attribute)
            .filter(([entity, matcher]) => isVerbEnabled(context, entity, matcher))
            .map(([_entity, matcher]) => verbs[matcher.verb])
            .filter(Boolean)
            .filter(verb => verb.contexts.length == 0
                    || verb.contexts.some(([_type, context]) => context === verbContext));
    // Multiple entities may have the same verbs, so make sure we only return unique instances
    return _.uniqBy(allVerbs, verb => verb.id);
  }

const directObjectSearch : SearchFn = (context, state) => {
  const verb = state.getPoS("verb")?.verb;
  const objs = verb && isTransitive(verb) ? getDirectObjects(context, verb) : [];
  return objs.map(obj => castDirectable(state).object(obj));
}

const attributeSearch : SearchFn = (context, state) => {
  const verb = state.getPoS("verb")?.verb;
  const attributes = verb ? getVerbAttributes(context, verb) : [];
  return attributes.map(attr => castPreopositional(state).preposition(attr));
}

const indirectObjectSearch : SearchFn = (context, state) => {
  const verb = state.getPoS("verb")?.verb;
  const preposition = state.getPoS("preposition")?.value;
  
  const objs = verb && preposition ? getIndirectObjects(context, verb, preposition) : [];
  // Don't allow the same object to be used as both direct and indirect
  const directObj = state.find(part => part.type === "directObject") as DirectObject;
  return objs.filter(obj => obj.id !== directObj?.entity?.id)
             .map(obj => castIndirectable(state).object(obj));
}

const modifierSearch : SearchFn = (context, state) => {
    const verb = state.getPoS("verb")?.verb;
    const newModifiers = verb? getVerbModifiers(context, verb) : {};
    return multidict.entries(newModifiers).map(([modType, modValue]) => castModifiable(state).modifier(modType, modValue))}

const TRANS_VERB = getVerbSearch(verb => isTransitive(verb));
const INTRANS_VERB = getVerbSearch(verb => isIntransitive(verb));
const DIRECT_OBJECT = directObjectSearch;
const ATTRIBUTE = attributeSearch;
const INDIRECT_OBJECT = indirectObjectSearch;
const MODIFIER = modifierSearch;

const WORD_PATTERNS = Tree.fromArrays([
  [INTRANS_VERB],
  [INTRANS_VERB, MODIFIER],
  [TRANS_VERB, DIRECT_OBJECT],
  [TRANS_VERB, DIRECT_OBJECT, MODIFIER],
  [TRANS_VERB, DIRECT_OBJECT, ATTRIBUTE, INDIRECT_OBJECT]
]);

const doSearch = (context : SearchContext,
                  searchNode = WORD_PATTERNS,
                  state = INITIAL_STATE) : SearchResult[] => {
  const results : SearchResult[] = [];
  Tree.forEachChild(searchNode, node => {
    const searchFn = Tree.getValue(node);
    const commands = searchFn(context, state);
    commands.forEach(result => results.push([result, node]));
  });
  logger.debug(() => `doSearch(${state}) = [${results.map(([sentance,_search]) => "[" + sentance + "]").join(",")}]`)
  return results;
}

const searchAll = (context : SearchContext,
                   searchNode = WORD_PATTERNS,
                   state = INITIAL_STATE) : Command[] => {
  const results = doSearch(context, searchNode, state);
  const states : Command[] = [];
  if (Tree.isTerminal(searchNode) && state.isValid()) {
    states.push(state);
  }
  if (results.length) {
    const newStates = results.flatMap(result => {
      const [state, node] = result;
      return searchAll(context, node, state);
    });
    states.push(...newStates);
  } 
  return states;
}

/**
 * Takes a partial command and looks for matches
 * 
 * Searches for one word at a time, and checks for a match against the partially provided command.
 * 
 * @param terms A list of search terms to match against, may include wild cards
 * @param context 
 * @param searchNode 
 * @param state 
 * @returns 
 */
export const search = (terms : SearchTerm[],
                       context : SearchContext,
                       searchNode = WORD_PATTERNS,
                       state = INITIAL_STATE) : Command[] => {
    const results = doSearch(context, searchNode, state)
    const matches = results.filter(([state, _]) => 
          Arrays.wildcardPrefixEquals(terms, getStateTerms(state), SearchTerm.WILD_CARD))
    const commands = matches.flatMap(([state, node]) =>
                                  (state.size() == terms.length) 
                                        ? isValid(context, node, state) ? [state] : []
                                        : search(terms, context, node, state));
    return commands;
}

export const getStateTerms = (state : Command) : SearchTerm[] => {
  return SearchTerm.fromStrings(...state.getWords().map(idValue => idValue.id));
}


/**
 * Test if a particular state can lead to a valid sentence
 * eg, if an attributed verb such as ask, has an appropriate indirect object available
 *     ask barman about ...
 * @param context 
 * @param searchNode 
 * @param state 
 * @returns 
 */
const isValid = (context : SearchContext,
                 searchNode = WORD_PATTERNS,
    state = INITIAL_STATE) : boolean => {
      const valid = state.isValid()
          ? true
          : doSearch(context, searchNode, state)
              .some(([sentenceNode, searchNode]) => isValid(context, searchNode, sentenceNode))
      logger.trace(() => `isValid(${state.toString()}) = ${valid}`);
      return valid;
    }

/**
 * Find an exact match for the provided command
 * @param command 
 * @param context 
 * @returns a Command, or undefined if no match could be found
 */
export const searchExact = (command : string[],
                            context : SearchContext) : Command | undefined => {
    const result = search(SearchTerm.fromStrings(...command), context);
    return result[0]?.isValid()? result[0] : undefined;
}
                        
