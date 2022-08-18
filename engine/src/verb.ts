import { Obj } from "./types";
import { getString } from "./obj";
import { Thunk } from "./script/thunk";
import { Nameable } from "./nameable";

export type VerbContext = string;

export type VerbTrait = "transitive" | "intransitive" | "modifiable";

export interface Verb extends Nameable {
  id : string;
  attributes : string[];
  traits : VerbTrait[];
  modifiers : string[];
  actions : Thunk[];
  contexts : VerbContext[];
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
  actions : Thunk[] = [];
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
  
  withAction(action : Thunk) : VerbBuilder {
    this.actions.push(action);
    return this;
  }

  withContext(context : VerbContext) : VerbBuilder {
    this.contexts.push(context);
    return this;
  }

  build() : Verb {
    return {...this.props,
             id : this.id, 
             attributes : this.attributes, 
             traits : this.traits,
             modifiers : this.modifiers, 
             actions : this.actions, 
             contexts : this.contexts };
  }
}

