import { MultiDict } from "./util/multidict";
import { Obj, ObjValue } from "./types";
import { getString, getArray } from "./obj";
import { Action } from "./action";


enum PROPS {
  ID = "id",
  TAGS = "tags",
  TYPE = "type"
}

//type VerbModMap = {[key:string]: string[]};

export class Entity {
  readonly id : string;
  readonly props : Obj;
  readonly verbs : VerbMatcher[];
  readonly cverbs : VerbMatcher[];
  readonly verbModifiers : MultiDict<string>;
  readonly actions : Action[];

  constructor(id : string, 
              props : Obj,
              verbs : VerbMatcher[],
              cverbs : VerbMatcher[],
              verbModifiers: MultiDict<string>,
              actions : Action[]) {
     this.id = id;
     this.props = props;
     this.verbs = verbs;
     this.cverbs = cverbs;
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
    const tags = getArray(this.props[PROPS.TAGS]) || [];
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
  //readonly qualifier : boolean;
}

function buildVerbMatcher(verb : string, attribute? : string) : VerbMatcher {
  return {
    verb: verb,
    attribute: attribute,
    //qualifier: false,
  };
}

export class EntityBuilder {
  id : string;
  props : Obj;
  verbs : VerbMatcher[] = [];
  cverbs : VerbMatcher[] = [];
  verbModifiers : MultiDict<string> = {};
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

  withAction(action : Action) {
    this.actions.push(action);
  }

  build() : Entity {
    return new Entity(this.id, this.props, this.verbs, this.cverbs, this.verbModifiers, this.actions);   
  }
}


