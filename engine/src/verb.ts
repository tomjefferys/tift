import { Nameable } from "./nameable";
import { ActionSource } from "./actionsource";
import { MainAction } from "./script/phaseaction";
import _ from "lodash";

// For verbs with two objects, they objects could be from two different contexts
// eg put ball ('inventory') in box ('environment')
export type ContextType = "direct" | "indirect";

// The verb context describes where an object needs to be for the verb to be useful
// eg in inventory, or in the environment
export type VerbContext = [ContextType, string];

export type VerbTrait = "transitive" | "intransitive" | "modifiable" | "instant" | "indirectOptional";

export interface Verb extends Nameable, ActionSource {
  id : string,
  attributes : string[],
  traits : VerbTrait[],
  modifiers : string[],
  actions : MainAction[],
  contexts : VerbContext[],
  [props : string] : unknown
}

export function isTransitive(verb : Verb) {
    return verb.traits.includes("transitive");
}

export function isIntransitive(verb : Verb) {
    return verb.traits.includes("intransitive");
}

// An "instant" verb does not take any time to execute
// so won't increment turn count, or trigger any rules
export function isInstant(verb : Verb) {
    return verb.traits.includes("instant");
}

export function isModifiable(verb : Verb) : boolean {
  return verb.modifiers.length !== 0;
}

/**
 * Checks if a verb has the indirectOptional trait
 * This is for a transitive verb that can function without a preoposition and 
 *  and indirect object
 */
export function isIndirectOptional(verb : Verb) {
  return verb.traits.includes("indirectOptional");
}

export function isAttributed(verb : Verb) : boolean {
  return verb.attributes.length !== 0;
}


