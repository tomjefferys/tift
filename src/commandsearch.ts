import { Verb } from "./verb"
import { Obj } from "./obj"

// verb                                -- intranitive verb
// verb object                         -- transitive verb
// verb object (with) object           -- transitive verb with attribute
// verb direction                      -- intransitive verb with qualifier
// verb object direction               -- tranistive verb with qualifier
// verb object direction (with) object -- transitive verb with qual and attr

type VerbMap = {[key:string]:Verb}


export function getWordOptions(obj: Obj[], verbs: Verb[]) : WordOption[] {
    const verbMap : VerbMap = {};
    for(const verb of verbs) {
      verbMap[verb.id] = verb;
    }
    return getVerbSearch(obj, verbMap)();
}
 
export interface WordOption {
  word : string;
  getNextWordOptions : () => WordOption[];
  usable : boolean;
  terminal : boolean;
}

function getVerbSearch(objs : Obj[], verbs : VerbMap) : () => WordOption[] {
  return () => {
    let matches : {[key:string] : Obj[]} = {};
    for(const obj of objs) {
      for(const matcher of obj.verbs) {
        if (verbs[matcher.verb]) {
          if (!matches[matcher.verb]) {
            matches[matcher.verb] = [];
          }
          matches[matcher.verb].push(obj);
        }
      }     
    } 
  
    let result : WordOption[] = [];
    Object.entries(matches).forEach(
      ([verbName, objMatches]) => result.push(
        {usable:true,
         terminal: true,
         word:verbName,
         getNextWordOptions: getObjSearch(verbs[verbName], objMatches) }))
    
    return result;
  };
}

function getObjSearch(verb : Verb, directObjs : Obj[]) {
  return () => {
     let result : WordOption[] = [];
     for(const obj of directObjs) {
        result.push({
          usable:true,
          terminal: true,
          word: obj.id,
          getNextWordOptions: () => [] });
     }    
     return result;
  }
}


