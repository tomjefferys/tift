import { isIntransitive, isTransitive, isClausal, Verb, VerbContext } from "./verb"
import { VerbMap } from "./types"
import { Entity, VerbMatcher, VerbModifier } from "./entity"
import { MultiDict } from "./util/multidict"
import * as _ from "lodash"
import * as multidict from "./util/multidict"
import * as Tree from "./util/tree"
import * as Arrays from "./util/arrays"
import { castDirectable, castIndirectable, castModifiable, castPreopositional,
         castSubVerbable, castSubDirectable, castSubModifiable,
         castSubPrepositional, castSubIndirectable,
         Command, start, castVerbable, DirectObject, SubObject } from "./command"
import { Env } from "tift-types/src/env"
import * as Logger from "./util/logger"
import { PartOfSpeech, Word } from "tift-types/src/messages/word"
import * as SearchTerm from "./searchterm";

// verb                                        -- intransitive verb
// verb object                                 -- transitive verb
// verb object (with) object                   -- transitive verb with attribute
// verb direction                              -- intransitive verb with qualifier
// verb object (to) direction                  -- transitive verb with qualifier
// verb object direction (with) object         -- transitive verb with qual and attr
// verb object (to) subVerb                            -- clausal verb (sub-command), eg "tell robot to go"
// verb object (to) subVerb direction                  -- clausal verb, sub-command with modifier
// verb object (to) subVerb subObject                  -- clausal verb, sub-command with direct object
// verb object (to) subVerb (with) subObject           -- clausal verb, sub-command with attribute
// verb object (to) subVerb subObject (with) subObject -- clausal verb, sub-command with object and attribute

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

  const partialTerms = SearchTerm.fromStrings(...partial);
  const searchTerms = partialTerms.includes(SearchTerm.WILD_CARD)? partialTerms : [...partialTerms, SearchTerm.WILD_CARD];
  
  const wildCardIndex = searchTerms.findIndex(term => term === SearchTerm.WILD_CARD);

  const nextWords = search(searchTerms, context)
          .map(state => {
            const word = state.getWords()[wildCardIndex];
            const contexts = state.getContexts().map(context => "context:" + context);
            const tags = [...contexts, ...(word.tags ?? [])];
            return { ...word, tags };
          });
  
  const uniqueNextWords = getUniqueWords(nextWords);
  return uniqueNextWords;
}

/**
 * Create a list of unique words, merging tags in any duplicates
 * @param words list of words, possibly with duplicates
 * @returns list of unique words
 */
function getUniqueWords(words : PartOfSpeech[]) : PartOfSpeech[] {
  const uniqueWords : PartOfSpeech[] = [];
  for (const word of words) {
    const index = uniqueWords.findIndex(w => w.id === word.id);
    if (index !== -1) {
      const match = uniqueWords[index];
      const tags = _.uniq([...(match.tags ?? []), ...(word.tags ?? [])]);
      const mergedWord = { ...match, tags };
      uniqueWords[index] = mergedWord;
    } else {
      uniqueWords.push(word);
    }
  }
  return uniqueWords;
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

// Check if a verb or a verb modifier is enabled in the current context
function isEnabled(context : SearchContext, entity : Entity, verbMatcher : VerbMatcher | VerbModifier) : boolean {
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
  return entities.filter(entity => entity.verbs.filter(verbMatcher => isEnabled(context, entity, verbMatcher))
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
                        testAttributeMatches(matcher, verb, attribute) && isEnabled(context, obj, matcher)));
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
  // A clausal verb's attribute (eg "to") introduces a sub-command rather than an
  // indirect object, so it's offered whenever there's at least one sub-verb available,
  // rather than being tied to any particular entity's verb matcher.
  if (isClausal(verb)) {
    return getSubVerbs(context, verb).length ? verb.attributes : [];
  }
  const objs = getIndirectObjects(context, verb);
  return objs.flatMap(entity =>
                entity.verbs.filter(verbMatcher => verbMatcher.verb === verb.id)
                            .filter(verbMatcher => isEnabled(context, entity, verbMatcher)))
             .filter(verbMatcher => verbMatcher.attribute)
             .map(verbMatcher => verbMatcher.attribute as string);
}

/**
 * Return the sub-verbs a clausal verb (eg "tell") will accept, resolved from its
 * `commands` allow-list against the verbs available in the current context.
 */
function getSubVerbs(context : SearchContext, verb : Verb) : Verb[] {
  return verb.commands.map(id => context.verbs[id]).filter((v) : v is Verb => Boolean(v));
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
              .flatMap(obj => obj.verbModifiers 
                                ?  multidict.get(obj.verbModifiers, modifier)
                                         .map(mod => [obj, mod] as [Entity, VerbModifier])
                                : [])
              .filter(([obj,mod]) => isEnabled(context, obj, mod))
              .map(([_obj, mod]) => mod.value);
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
        .forEach(state => {
          state.contexts.push(verbContext);
          states.push(state);
        });
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
            .filter(([_entity, matcher]) => !matcher.attribute || (verbs[matcher.verb].traits.includes("intransitive")))
            .filter(([entity, matcher]) => isEnabled(context, entity, matcher))
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

/**
 * Creates a search function to match sub-verbs (of a clausal verb such as "tell") with entities
 * @param filter a filter for the results, eg only transitive sub-verbs
 * @returns the Search Function
 */
const getSubVerbSearch = (filter: (verb: Verb) => boolean) : SearchFn => {
  return (context, state) => {
    const verb = state.getPoS("verb")?.verb;
    const preposition = state.getPoS("preposition")?.value;
    if (!verb || !isClausal(verb) || !preposition) {
      return [];
    }
    return getSubVerbs(context, verb)
              .filter(filter)
              .map(subVerb => castSubVerbable(state).subVerb(subVerb));
  }
}

const subObjectSearch : SearchFn = (context, state) => {
  const subVerb = state.getPoS("subVerb")?.verb;
  const objs = subVerb && isTransitive(subVerb) ? getDirectObjects(context, subVerb) : [];
  return objs.map(obj => castSubDirectable(state).subObject(obj));
}

const subModifierSearch : SearchFn = (context, state) => {
    const subVerb = state.getPoS("subVerb")?.verb;
    const newModifiers = subVerb ? getVerbModifiers(context, subVerb) : {};
    return multidict.entries(newModifiers).map(([modType, modValue]) => castSubModifiable(state).subModifier(modType, modValue))}

const subAttributeSearch : SearchFn = (context, state) => {
  const subVerb = state.getPoS("subVerb")?.verb;
  const attributes = subVerb ? getVerbAttributes(context, subVerb) : [];
  return attributes.map(attr => castSubPrepositional(state).subPreposition(attr));
}

const subIndirectObjectSearch : SearchFn = (context, state) => {
  const subVerb = state.getPoS("subVerb")?.verb;
  const subPreposition = state.getPoS("subPreposition")?.value;

  const objs = subVerb && subPreposition ? getIndirectObjects(context, subVerb, subPreposition) : [];
  // Don't allow the same object to be used as both the sub-command's direct and indirect object
  const subDirectObj = state.find(part => part.type === "subObject") as SubObject;
  return objs.filter(obj => obj.id !== subDirectObj?.entity?.id)
             .map(obj => castSubIndirectable(state).subObject(obj));
}

const TRANS_VERB      = getVerbSearch(verb => isTransitive(verb));
const INTRANS_VERB    = getVerbSearch(verb => isIntransitive(verb));
const DIRECT_OBJECT   = directObjectSearch;
const ATTRIBUTE       = attributeSearch;
const INDIRECT_OBJECT = indirectObjectSearch;
const MODIFIER        = modifierSearch;
const SUB_TRANS_VERB       = getSubVerbSearch(verb => isTransitive(verb));
const SUB_INTRANS_VERB     = getSubVerbSearch(verb => isIntransitive(verb));
const SUB_OBJECT           = subObjectSearch;
const SUB_MODIFIER         = subModifierSearch;
const SUB_ATTRIBUTE        = subAttributeSearch;
const SUB_INDIRECT_OBJECT  = subIndirectObjectSearch;

// When adding a new word pattern, make sure it is covered by a validator in command.ts
const WORD_PATTERNS = Tree.fromArrays([
  [INTRANS_VERB],
  [INTRANS_VERB, MODIFIER],
  [INTRANS_VERB, ATTRIBUTE, INDIRECT_OBJECT],
  [TRANS_VERB, DIRECT_OBJECT],
  [TRANS_VERB, DIRECT_OBJECT, MODIFIER],
  [TRANS_VERB, DIRECT_OBJECT, ATTRIBUTE, INDIRECT_OBJECT],
  [TRANS_VERB, DIRECT_OBJECT, ATTRIBUTE, SUB_INTRANS_VERB],
  [TRANS_VERB, DIRECT_OBJECT, ATTRIBUTE, SUB_INTRANS_VERB, SUB_MODIFIER],
  [TRANS_VERB, DIRECT_OBJECT, ATTRIBUTE, SUB_INTRANS_VERB, SUB_ATTRIBUTE, SUB_INDIRECT_OBJECT],
  [TRANS_VERB, DIRECT_OBJECT, ATTRIBUTE, SUB_TRANS_VERB, SUB_OBJECT],
  [TRANS_VERB, DIRECT_OBJECT, ATTRIBUTE, SUB_TRANS_VERB, SUB_OBJECT, SUB_ATTRIBUTE, SUB_INDIRECT_OBJECT]
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
                        
