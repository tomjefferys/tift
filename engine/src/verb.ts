import { Obj } from "./types";
import { getString } from "./obj";
import { Nameable } from "./nameable";
import { ActionSource } from "./actionsource";
import { AfterAction, BeforeAction, MainAction } from "./script/phaseaction";

export type VerbContext = string;

export type VerbTrait = "transitive" | "intransitive" | "modifiable";

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

export function isModifiable(verb : Verb) : boolean {
  return verb.modifiers.length !== 0;
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

  withContext(context : VerbContext) : VerbBuilder {
    this.contexts.push(context);
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

