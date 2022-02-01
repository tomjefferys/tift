import { Verb } from "./verb"
import { Obj, VerbMatcher } from "./obj"
import { MultiDict } from "./util/multidict"
import * as multidict from "./util/multidict"

// verb                                -- intranitive verb
// verb object                         -- transitive verb
// verb object (with) object           -- transitive verb with attribute
// verb direction                      -- intransitive verb with qualifier
// verb object (to) direction          -- tranistive verb with qualifier
// verb object direction (with) object -- transitive verb with qual and attr

type VerbMap = {[key:string]:Verb}
type ObjMap  = {[key:string]:Obj}

type NextWordFn = () => WordOption[];

const EMPTY_SEARCH = () => [];

export interface WordOption {
  word : string;
  getNextWordOptions : NextWordFn;
  usable : boolean;
}

export function getWordOptions(obj: Obj[], verbs: Verb[]) : WordOption[] {
  const context = buildSearchContext(obj, verbs);
  return getVerbSearch(context)();
}

export function getAllCommands(objs: Obj[], verbs: Verb[]) : string[][] {
  return getWordOptions(objs, verbs)
            .flatMap(option => expandWordOption([], option));
}

function expandWordOption(prefix : string[], wordOption : WordOption) : string[][] {
  const result : string[][] = [];
  if (wordOption.usable) {
    result.push([...prefix, wordOption.word]);
  }
  wordOption.getNextWordOptions()
            .flatMap(nextWord => expandWordOption([...prefix, wordOption.word], nextWord))
            .forEach(sentance => result.push(sentance));
  return result;
}
 

interface SearchContext {
  objs:  ObjMap,
  verbs: VerbMap,
}

function buildSearchContext(objs : Obj[], verbs : Verb[]) : SearchContext {
  return {
    objs: objs.reduce((map,obj) => {
            map[obj.id] = obj;
            return map;
          }, {} as ObjMap),
    verbs: verbs.reduce((map,verb) => {
             map[verb.id] = verb;
             return map;
          }, {} as VerbMap)
  };
}



/**
 * Return all direct object in the context matching a single verb
 */
function getDirectObjects(context : SearchContext, verb : Verb) : Obj[] {
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
                            attribute? : string) : Obj[] {
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

/**
 * Takes a set of objects and verbs, and creates a list of 
 * possible verbs
 */
function getVerbSearch(context: SearchContext) : NextWordFn {
  return () => {
    const matches  = Object.values(context.objs)
                           .flatMap(obj => obj.verbs)
                           .filter(matcher => !matcher.attribute)
                           .map(matcher => context.verbs[matcher.verb])
                           .filter(result => result);
  
    return matches.map((verb) => getWordOptionsForVerb(context, verb));
  };
}


function getWordOptionsForVerb(context : SearchContext, verb : Verb) {
  const objectSearch = verb.isTransitive()
                        ? getDirectObjectSearch(context, verb)
                        : EMPTY_SEARCH;
  let nextWordFn : () => WordOption[];
  if (verb.isIntransitive()) {
    const modifierSearch = getModifierSearch(context, verb);
    nextWordFn = () => objectSearch().concat(modifierSearch())
  } else {
    nextWordFn = objectSearch;
  }
  return {
    usable: verb.isIntransitive() && !verb.isModifiable,
    word: verb.getName(),
    getNextWordOptions : nextWordFn
  };
}

function getDirectObjectSearch(
          context : SearchContext,
          verb : Verb) : NextWordFn {
  const attributeSearch = verb.attributes.length
                        ? getAttributeSearch(context, verb)
                        : EMPTY_SEARCH;

  const modifierSearch = getModifierSearch(context, verb);
  const nextWordFn = () => attributeSearch().concat(modifierSearch());
  
  return () => 
     getDirectObjects(context, verb)
       .map((obj) => ({
         usable : !verb.isModifiable(),
         word : obj.id,
         getNextWordOptions: nextWordFn }));
}

function getModifierSearch(
          context : SearchContext,
          verb : Verb) : () => WordOption[] {
  return () => 
    Object.values(getVerbModifiers(context,verb))
      .flatMap(value => value)
      .map(modifier => ({
        usable : true,
        word : modifier,
        getNextWordOptions : EMPTY_SEARCH
      }))
}

function getAttributeSearch(context : SearchContext, verb : Verb) : NextWordFn {
  return () =>
     getVerbAttributes(context,verb)
        .map(word => ({
           usable : false,
           word : word,
           getNextWordOptions: getIndirectObjectSearch(context, verb, word)}));
}

function getIndirectObjectSearch(
            context : SearchContext,
            verb : Verb,
            attribute : string) : NextWordFn {
  return () =>
    getIndirectObjects(context, verb, attribute)
        .map(obj => ({
           usable : true,
           word : obj.id,
           getNextWordOptions: EMPTY_SEARCH}));
}

