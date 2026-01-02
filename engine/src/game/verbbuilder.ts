import { Obj } from "tift-types/src/util/objects"
import { Verb, VerbTrait, VerbContext, ContextType } from "../verb";
import { BeforeAction, MainAction, AfterAction } from "../script/phaseaction";
import { getString, KIND } from "../util/objects";
import * as Errors from "../util/errors";
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
      Errors.throwErrorWithObj("An Entity must have properties", {}, []);
    }
    if (!props["id"]) {
      Errors.throwErrorWithObj("An Entity must have an id property", props, []);
    }
    if (props["tags"] && !_.isArray(props["tags"])) {
      Errors.throwErrorWithObj(`${props["id"]}.tags is not an array`, props, "tags");
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

  withAttributes(attributes : string[]) : VerbBuilder {
    this.attributes.push(...attributes);
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
  
  withActions(actions : MainAction[]) : VerbBuilder {
    this.actions.push(...actions);
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