import { Verb } from "./verb"
import { Obj, VerbMatcher } from "./obj"

// verb                                -- intranitive verb
// verb object                         -- transitive verb
// verb object (with) object           -- transitive verb with attribute
// verb direction                      -- intransitive verb with qualifier
// verb object (to) direction          -- tranistive verb with qualifier
// verb object direction (with) object -- transitive verb with qual and attr

type VerbMap = {[key:string]:Verb}
type ObjMap  = {[key:string]:Obj}

const EMPTY_SEARCH = () => [];


export function getWordOptions(obj: Obj[], verbs: Verb[]) : WordOption[] {
  const context = buildSearchContext(obj, verbs);
  return getVerbSearch(context)();
}
 
export interface WordOption {
  word : string;
  getNextWordOptions : () => WordOption[];
  usable : boolean;
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
                    verbMatcher.verb === verb.id));
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
 * Takes a set of objects and verbs, and creates a list of 
 * possible verbs
 */
function getVerbSearch(context: SearchContext) : () => WordOption[] {
  return () => {
    const matches : Verb[] = Object.values(context.objs)
                                    .flatMap((obj) => obj.verbs)
                                    .map((matcher) => context.verbs[matcher.verb])
                                    .filter(result => result);
  
    return matches.map((verb) => getWordOptionsForVerb(context, verb));
  };
}


function getWordOptionsForVerb(context : SearchContext, verb : Verb) {
  const nextWordFn = verb.isTransitive()
                        ? getDirectObjectSearch(context, verb)
                        : EMPTY_SEARCH;
  return {
    usable: verb.isIntransitive(),
    word: verb.getName(),
    getNextWordOptions : nextWordFn
  };
}

function getDirectObjectSearch(
          context : SearchContext,
          verb : Verb) : () => WordOption[] {
  const nextWordFn = verb.attributes.length
                        ? getAttributeSearch(context, verb)
                        : EMPTY_SEARCH;
  return () => 
     getDirectObjects(context, verb)
       .map((obj) => ({
         usable : true,
         word : obj.id,
         getNextWordOptions: nextWordFn }));
}

function getAttributeSearch(context : SearchContext, verb : Verb) : () => WordOption[] {
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
            attribute : string) : () => WordOption[] {
  return () =>
    getIndirectObjects(context, verb, attribute)
        .map(obj => ({
           usable : true,
           word : obj.id,
           getNextWordOptions: EMPTY_SEARCH}));
}

