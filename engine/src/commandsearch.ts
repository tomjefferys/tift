import { Verb } from "./verb"
import { VerbMap, EntityMap } from "./types"
import { Entity, VerbMatcher } from "./entity"
import { MultiDict } from "./util/multidict"
import * as multidict from "./util/multidict"
import * as Tree from "./util/tree"

// verb                                -- intranitive verb
// verb object                         -- transitive verb
// verb object (with) object           -- transitive verb with attribute
// verb direction                      -- intransitive verb with qualifier
// verb object (to) direction          -- tranistive verb with qualifier
// verb object direction (with) object -- transitive verb with qual and attr

interface SearchState {
  readonly verb? : Verb;
  readonly directObject? : Entity;
  readonly attribute? : string;
  readonly indirectObject? : Entity;
  readonly modifiers : {[key:string]:string};
  readonly words : string[];
}

type SearchFn = (context: SearchContext, state: SearchState) => SearchState[]; 
type SearchNode = Tree.ValueNode<SearchFn>;
type SearchResult = [SearchState, SearchNode];

const INITIAL_STATE : SearchState = {modifiers : {}, words : []};

export function getAllCommands(objs: Entity[], verbs: Verb[]) : string[][] {
  const context = buildSearchContext(objs, verbs);
  return searchAll(context)
          .map(state => state.words);
}

interface SearchContext {
  objs:  EntityMap,
  verbs: VerbMap,
}

function buildSearchContext(objs : Entity[], verbs : Verb[]) : SearchContext {
  return {
    objs: objs.reduce((map,obj) => {
            map[obj.id] = obj;
            return map;
          }, {} as EntityMap),
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
  return Object.values(context.objs)
               .filter(obj => 
                  obj.verbs.some((verbMatcher) => 
                    verbMatcher.verb === verb.id && !verbMatcher.attribute));
}

/**
 * Return all indirect objects in the context for a single verb
 */
function getIndirectObjects(context : SearchContext,
                            verb : Verb,
                            attribute? : string) : Entity[] {
  return Object.values(context.objs)
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
          multidict.addUnique(modMap, modifier, getModifierValues(context, modifier))
      , {});

const getModifierValues = (context : SearchContext, modifier : string) : string[] => 
      Object.values(context.objs).flatMap(obj => 
        multidict.get(obj.verbModifiers, modifier))

const getVerbSearch = (filter: (verb: Verb) => boolean) : SearchFn => {
  return (context, state) =>
        Object.values(context.objs)
              .flatMap(obj => obj.verbs)
              .filter(matcher => !matcher.attribute)
              .map(matcher => context.verbs[matcher.verb])
              .filter(Boolean)
              .filter(filter)
              .map(verb => ({...state,
                verb: verb,
                words: [...state.words, verb.getName()]}));
}

const directObjectSearch : SearchFn = (context, state) => {
  const objs = state.verb && state.verb.isTransitive()
                  ? getDirectObjects(context, state.verb)
                  : [];
  return objs.map(obj => ({...state,
                directObject : obj,
                words: [...state.words, obj.getName()]}));
}

const attributeSearch : SearchFn = (context, state) => {
  const attributes = state.verb
                      ? getVerbAttributes(context, state.verb)
                      : [];
  return attributes.map(attr => ({...state,
                                  attribute: attr,
                                  words: [...state.words, attr]}));
}

const indirectObjectSearch : SearchFn = (context, state) => {
  const objs = state.verb && state.attribute
                ? getIndirectObjects(context, state.verb, state.attribute)
                : [];
  return objs.map(obj => ({...state,
                          indirectObject: obj,
                          words: [...state.words, obj.getName()]}));
}

const modifierSearch : SearchFn = (context, state) => {
    const newModifiers = state.verb? getVerbModifiers(context, state.verb) : {};
    return multidict.entries(newModifiers)
             .map(([modType, modValue]) => {
                return {...state,
                        modifiers: {...state.modifiers, [modType]: modValue},
                        words: [...state.words, modValue]}
             });
}

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
                   state = INITIAL_STATE) : SearchState[] => {
  const results = doSearch(context, searchNode, state);
  const states : SearchState[] = [];
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
