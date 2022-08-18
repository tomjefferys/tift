import { MultiDict } from "./util/multidict";
import { Obj } from "./env";
import { getString, getArray } from "./obj";
import { Thunk } from "./script/thunk";

enum PROPS {
  ID = "id",
  TAGS = "tags",
  TYPE = "type"
}

export interface Entity {
  id : string,
  verbs : VerbMatcher[],
  verbModifiers : MultiDict<string>
  actions : Thunk[];
  [props : string]: unknown
}

export function getName(entity : Entity) : string {
  return entity["name"] as string ?? entity.id;
}

export function getType(entity : Entity) : string {
    const type = entity[PROPS.TYPE];
    if (!type) {
      throw new Error("Entity: " + entity.id + " has no type");
    }
    return type as string;
  }

export function hasTag(entity : Entity, tag : string) : boolean {
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
  actions : Thunk[] = [];
  
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

  withAction(action : Thunk) {
    this.actions.push(action);
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
    return {...this.props, id : this.id, verbs : this.verbs, verbModifiers : this.verbModifiers, actions : this.actions};
  }
}


