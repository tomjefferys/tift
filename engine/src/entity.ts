import { MultiDict } from "./util/multidict";
import { Obj, ObjValue } from "./types";
import { getString, getArray } from "./obj";
import { Thunk } from "./script/thunk";


enum PROPS {
  ID = "id",
  TAGS = "tags",
  TYPE = "type"
}

//type VerbModMap = {[key:string]: string[]};

// TODO I don't think we need a class for this, possibly not even an interface
// The engine builder should just construct an object with the appropriate properties
export class Entity {
  readonly id : string;
  readonly props : Obj;
  readonly verbs : VerbMatcher[];
  readonly verbModifiers : MultiDict<string>;

  // TODO should actions, just be thunks
  // like the before/after properties are supposed to be?
  readonly actions : Thunk[];

  constructor(id : string, 
              props : Obj,
              verbs : VerbMatcher[],
              verbModifiers: MultiDict<string>,
              actions : Thunk[]) {
     this.id = id;
     this.props = props;
     this.verbs = verbs;
     this.verbModifiers = verbModifiers;
     this.actions = actions;
   }

   getName() : string {
     return this.props["name"] as string ?? this.id;
   }

   getProp(name: string) : ObjValue {
     if (!this.props[name]) {
        throw new Error("Entity: " + this.id + " does not contain property: " + name);
     }
     return this.props[name];
   }

  hasTag(tag : string) : boolean {
    const tags = getArray(this.props[PROPS.TAGS] ?? []);
    return tags.indexOf(tag) != -1;
  }

  getType() : string {
    const type = this.props[PROPS.TYPE];
    if (!type) {
      throw new Error("Entity: " + this.id + " has no type");
    }
    return getString(type);
  }
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
  //actions : Action[] = [];
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
    return new Entity(this.id, this.props, this.verbs, this.verbModifiers, this.actions);   
  }
}


