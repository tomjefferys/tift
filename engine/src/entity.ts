import { MultiDict } from "./util/multidict";
import { Obj } from "./types";
import { getString } from "./obj";

//type VerbModMap = {[key:string]: string[]};

export class Entity {
  readonly id : string;
  readonly props : Obj;
  readonly verbs : VerbMatcher[];
  readonly cverbs : VerbMatcher[];
  readonly verbModifiers : MultiDict<string>;

  constructor(id : string, 
              props : Obj,
              verbs : VerbMatcher[],
              cverbs : VerbMatcher[],
              verbModifiers: MultiDict<string>) {
     this.id = id;
     this.props = props;
     this.verbs = verbs;
     this.cverbs = cverbs;
     this.verbModifiers = verbModifiers;
   }

   getName() : string {
     return this.props["name"] as string ?? this.id;
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

  build() : Entity {
    return new Entity(this.id, this.props, this.verbs, this.cverbs, this.verbModifiers);   
  }
}
