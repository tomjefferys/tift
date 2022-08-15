import { Verb, VerbContext } from "./verb"
import { VerbMap } from "./types"
import { Entity, VerbMatcher } from "./entity"
import { MultiDict } from "./util/multidict"
import { IdValue } from "./shared"
import * as multidict from "./util/multidict"
import * as Tree from "./util/tree"
import * as Arrays from "./util/arrays"
import { castDirectable, castIndirectable, castModifiable, castPreopositional, Command, start, castVerbable } from "./command"

// verb                                -- intranitive verb
// verb object                         -- transitive verb
// verb object (with) object           -- transitive verb with attribute
// verb direction                      -- intransitive verb with qualifier
// verb object (to) direction          -- tranistive verb with qualifier
// verb object direction (with) object -- transitive verb with qual and attr

type SearchFn = (context: SearchContext, state: Command) => Command[]; 
type SearchNode = Tree.ValueNode<SearchFn>;
type SearchResult = [Command, SearchNode];

export type ContextEntities = MultiDict<Entity>;

const INITIAL_STATE : Command = start();

export function getAllCommands(objs: ContextEntities, verbs: Verb[]) : IdValue<string>[][] {
  const context = buildSearchContext(objs, verbs);
  return searchAll(context)
          .map(state => state.getWords());
}

export interface SearchContext {
  objs:  ContextEntities,
  verbs: VerbMap,
}

export function buildSearchContext(objs : ContextEntities, verbs : Verb[]) : SearchContext {
  return {
    objs: objs,
    verbs: verbs.reduce((map,verb) => {
             map[verb.id] = verb;
             return map;
          }, {} as VerbMap)
  };
}


/**
 * Return all direct object in the context matching a single verb
 */
function getDirectObjects(context : SearchContext, verb : Verb) : Entity[] {
  const entities = filterEntities(context.objs, verb.contexts);
  return entities
               .filter(obj => 
                  obj.verbs.some((verbMatcher) => 
                    verbMatcher.verb === verb.id && !verbMatcher.attribute));
}

function filterEntities(entities : ContextEntities, verbContexts : VerbContext[]) {
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
  const entities = filterEntities(context.objs, verb.contexts);
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
 * Return all verb attibutes available in a context matching a single verb
 */
function getVerbAttributes(context : SearchContext, verb : Verb) : string[] {
  const objs = getIndirectObjects(context, verb);
  return objs.flatMap(obj => 
                obj.verbs.filter(verbMatcher => verbMatcher.verb === verb.id))
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
    const entities = filterEntities(context.objs, verbContexts);
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
      getVerbs(entities, context.verbs, verbContext)
        .filter(filter)
        .map(v => castVerbable(state).verb(v))
        .forEach(state => states.push(state));
    }
    return states;
  }
}

/**
 * Search entities for matching verbs, discarding any verb atribute matchers, and verbs not in the context
 * @param entities a list of entities 
 * @param verbs a list of verbs
 * @param context the verb-context to limit the search to
 * @returns a list of matching verbs
 */
const getVerbs = (entities : Entity[], verbs : VerbMap, context : VerbContext) : Verb[] => 
    entities.flatMap(entity => entity?.verbs ?? [])
            .filter(matcher => !matcher.attribute)
            .map(matcher => verbs[matcher.verb])
            .filter(Boolean)
            .filter(verb => verb.contexts.length == 0 || verb.contexts.includes(context));

const directObjectSearch : SearchFn = (context, state) => {
  const verb = state.getPoS("verb")?.verb;
  const objs = verb && verb.isTransitive() ? getDirectObjects(context, verb) : [];
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
  return objs.map(obj => castIndirectable(state).object(obj));
}

const modifierSearch : SearchFn = (context, state) => {
    const verb = state.getPoS("verb")?.verb;
    const newModifiers = verb? getVerbModifiers(context, verb) : {};
    return multidict.entries(newModifiers).map(([modType, modValue]) => castModifiable(state).modifier(modType, modValue))}

const TRANS_VERB = getVerbSearch(verb => verb.isTransitive());
const INTRANS_VERB = getVerbSearch(verb => verb.isIntransitive());
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
                  state = INITIAL_STATE) => {
  const results : SearchResult[] = [];
  Tree.forEachChild(searchNode, node => {
    const searchFn = Tree.getValue(node);
    searchFn(context, state).forEach(result => results.push([result, node]));
  });
  return results;
}

const searchAll = (context : SearchContext,
                   searchNode = WORD_PATTERNS,
                   state = INITIAL_STATE) : Command[] => {
  const results = doSearch(context, searchNode, state);
  const states : Command[] = [];
  if (Tree.isTerminal(searchNode)) {
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
 * Searches for one word at a time, and checks for a match against the partially provided command
 * Stops searching as soon as we've found an extra word
 * @param partial 
 * @param context 
 * @param searchNode 
 * @param state 
 * @returns 
 */
export const searchNext = (partial : string[],
                           context : SearchContext,
                           searchNode = WORD_PATTERNS,
                           state = INITIAL_STATE) : Command[] => 
    doSearch(context, searchNode, state)
                    .filter(([state, _]) => Arrays.prefixEquals(partial, state.getWords().map(idValue => idValue.id)))
                    .flatMap(([state, node]) => 
                                  (state.size() > partial.length) 
                                        ? [state] 
                                        : searchNext(partial, context, node, state));

/**
 * Find an exact match for the provided command
 * @param command 
 * @param context 
 * @param searchNode 
 * @param state 
 * @returns 
 */
export const searchExact = (command : string[],
                            context : SearchContext, 
                            searchNode = WORD_PATTERNS,
                            state = INITIAL_STATE) : Command | undefined => 
    doSearch(context, searchNode, state)
            .filter(([state, _]) => Arrays.prefixEquals(command, state.getWords().map(idValue => idValue.id)))
            .map(([state, node]) => {
              const wordLength = state.size();
              if (wordLength === command.length && Tree.isTerminal(node)) {
                return state;
              } else if (wordLength < command.length) {
                return searchExact(command, context, node, state);
              } else {
                return undefined;
              }
            }).find(_ => true);
                        
