import { Action } from "./action";
import { Obj } from "./types";
import { getString } from "./obj";

export enum VerbTrait {
  Transitive,
  Intransitive,
  Modifiable
}


export class Verb {
  readonly id : string;
  readonly props : Obj;
  readonly attributes : string[];
  readonly traits : VerbTrait[];
  readonly modifiers : string[];
  readonly actions : Action[];

  constructor(id : string,
              props : Obj,
              attributes : string[],
              traits : VerbTrait[],
              modifiers : string[],
              actions : Action[]) {
    this.id = id;
    this.props = props;
    this.attributes = attributes;
    this.traits = traits;
    this.modifiers = modifiers;
    this.actions = actions;
  }

  isTransitive() : boolean {
    return this.traits.includes(VerbTrait.Transitive);
  }

  isIntransitive() : boolean {
    return this.traits.includes(VerbTrait.Intransitive);
  }
  
  isModifiable() : boolean {
    return this.modifiers.length != 0;
  }

  getName() : string {
    return this.props["name"] as string ?? this.id;
  }
}

export class VerbBuilder {
  id : string;
  props : Obj;
  name? : string;
  attributes : string[] = [];
  traits : VerbTrait[] = [];
  modifiers : string[] = [];
  actions : Action[] = [];

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
  
  withAction(action : Action) : VerbBuilder {
    this.actions.push(action);
    return this;
  }

  build() : Verb {
    return new Verb(this.id, this.props, this.attributes, this.traits, this.modifiers, this.actions);
  }
  

}

