import { MultiDict } from "./util/multidict"

//type VerbModMap = {[key:string]: string[]};

export class Entity {
  readonly id : string;
  readonly name? : string;
  readonly verbs : VerbMatcher[];
  readonly cverbs : VerbMatcher[];
  readonly verbModifiers : MultiDict<string>;

  constructor(id : string, 
              name : string | undefined,
              verbs : VerbMatcher[],
              cverbs : VerbMatcher[],
              verbModifiers: MultiDict<string>) {
     this.id = id;
     this.name = name;
     this.verbs = verbs;
     this.cverbs = cverbs;
     this.verbModifiers = verbModifiers;
   }

   getName() : string {
     return this.name ?? this.id;
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
  name? : string;
  verbs : VerbMatcher[] = [];
  cverbs : VerbMatcher[] = [];
  verbModifiers : MultiDict<string> = {};
  
  constructor(id : string) {
    if (!id) {
      throw new Error("An Entity must have an id");
    }
    this.id = id;
  }

  withName(name : string) : EntityBuilder {
    this.name = name;
    return this;
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
    return new Entity(this.id, this.name, this.verbs, this.cverbs, this.verbModifiers);   
  }
}
