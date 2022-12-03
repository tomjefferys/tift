import { MultiDict } from "./util/multidict";
import { Obj } from "./env";
import { getString, getArray } from "./obj";
import { Nameable } from "./nameable";
import { ActionSource } from "./actionsource";
import { AfterAction, MainAction, BeforeAction } from "./script/phaseaction";

enum PROPS {
  ID = "id",
  TAGS = "tags",
  TYPE = "type"
}

export interface Entity extends Nameable, ActionSource {
  id : string,
  verbs : VerbMatcher[],
  verbModifiers : MultiDict<string>
  [props : string]: unknown
}

export function getType(entity : Entity) : string {
    const type = entity[PROPS.TYPE];
    if (!type) {
      throw new Error("Entity: " + entity.id + " has no type");
    }
    return type as string;
  }

export function hasTag(entity : Obj, tag : string) : boolean {
    const tags = (entity[PROPS.TAGS] ?? []) as string[];
    return tags.indexOf(tag) != -1;
}

export interface VerbMatcher {
  readonly verb : string;
  readonly attribute? : string;
}

function buildVerbMatcher(verb : string, attribute? : string) : VerbMatcher {
  return {
    verb: verb,
    attribute: attribute,
  };
}

export class EntityBuilder {
  id : string;
  props : Obj;
  verbs : VerbMatcher[] = [];
  verbModifiers : MultiDict<string> = {};
  before : BeforeAction[] = [];
  actions : MainAction[] = [];
  after : AfterAction[] = [];
  
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
  
  withVerb(verb: string) : EntityBuilder {
    this.verbs.push(buildVerbMatcher(verb));
    return this;
  }

  withAttributedVerb(verb : string, attribute : string) {
    this.verbs.push(buildVerbMatcher(verb, attribute));
    return this;
  }

  withVerbModifier(modType : string, value : string) {
    if (!this.verbModifiers[modType]) {
      this.verbModifiers[modType] = [];
    }
    this.verbModifiers[modType].push(value);
    return this;
  }

  withBefore(action : BeforeAction) {
    this.before.push(action);
    return this;
  }

  withAction(action : MainAction) {
    this.actions.push(action);
    return this;
  }

  withAfter(action : AfterAction) {
    this.after.push(action);
    return this;
  }

  withProp(name : string, value : string) {
    this.props[name] = value; 
  }

  withTag(tag : string) {
    if (!this.props[PROPS.TAGS]) {
      this.props[PROPS.TAGS] = [];
    }
    getArray(this.props[PROPS.TAGS]).push(tag);
  }

  build() : Entity {
    return {...this.props,
            id : this.id,
            verbs : this.verbs,
            verbModifiers : this.verbModifiers,
            before : this.before,
            actions : this.actions,
            after : this.after };
  }
}


