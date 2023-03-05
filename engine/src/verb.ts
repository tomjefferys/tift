import { Obj, getString } from "./util/objects";
import { Nameable } from "./nameable";
import { ActionSource } from "./actionsource";
import { AfterAction, BeforeAction, MainAction } from "./script/phaseaction";
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

export class VerbBuilder {
  id : string;
  props : Obj;
  name? : string;
  attributes : string[] = [];
  traits : VerbTrait[] = [];
  modifiers : string[] = [];
  before : BeforeAction[] = [];
  actions : MainAction[] = [];
  after : AfterAction[] = [];
  contexts : VerbContext[] = [];

  constructor(props : Obj) {
    if (!props) {
      throw new Error("An Entity must have properties");
    }
    if (!props["id"]) {
      throw new Error("An Entity must have an id property")
    }
    if (props["tags"] && !_.isArray(props["tags"])) {
      throw new Error(`${props["id"]}.tags is not an array`);
    }
    this.props = props;
    this.id = getString(props["id"]);
  } 
  
  withName(name : string) : VerbBuilder {
    this.name = name;
    return this;
  }
  
  withAttribute(attribute : string) : VerbBuilder {
    this.attributes.push(attribute);
    return this;
  }

  withTrait(trait : VerbTrait) : VerbBuilder {
    this.traits.push(trait);
    return this;
  }
  
  withModifier(modifier : string) : VerbBuilder {
    this.modifiers.push(modifier);
    return this;
  }

  withBefore(action : BeforeAction) : VerbBuilder {
    this.before.push(action);
    return this;
  }
  
  withAction(action : MainAction) : VerbBuilder {
    this.actions.push(action);
    return this;
  }

  withAfter(action : AfterAction) : VerbBuilder {
    this.after.push(action);
    return this;
  }

  withContext(context : string, type : ContextType = "direct") : VerbBuilder {
    this.contexts.push([type, context]);
    return this;
  }

  build() : Verb {
    return {...this.props,
             type : "verb",
             id : this.id, 
             attributes : this.attributes, 
             traits : this.traits,
             modifiers : this.modifiers, 
             before : this.before,
             actions : this.actions, 
             after : this.after,
             contexts : this.contexts };
  }
}

