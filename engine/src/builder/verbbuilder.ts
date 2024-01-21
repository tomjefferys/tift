import { Obj } from "tift-types/src/util/objects"
import { Verb, VerbTrait, VerbContext, ContextType } from "../verb";
import { BeforeAction, MainAction, AfterAction } from "../script/phaseaction";
import { getString, KIND } from "../util/objects";
import _ from "lodash"

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
             [KIND] : "verb",
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