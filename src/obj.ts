
type VerbModMap = {[key:string]: string[]};

export class Obj {
  readonly id : string;
  readonly name? : string;
  readonly verbs : VerbMatcher[];
  readonly cverbs : VerbMatcher[];
  readonly verbModifiers : VerbModMap;

  constructor(id : string, 
              name : string | undefined,
              verbs : VerbMatcher[],
              cverbs : VerbMatcher[],
              verbModifiers: VerbModMap) {
     this.id = id;
     this.name = name;
     this.verbs = verbs;
     this.cverbs = cverbs;
     this.verbModifiers = verbModifiers;
   }
}

export interface VerbMatcher {
  readonly verb : string;
  readonly attribute? : string;
  readonly qualifier : boolean;
}

function buildVerbMatcher(verb : string, attribute? : string) : VerbMatcher {
  return {
    verb: verb,
    attribute: attribute,
    qualifier: false,
  };
}

export class ObjBuilder {
  id : string;
  name? : string;
  verbs : VerbMatcher[] = [];
  cverbs : VerbMatcher[] = [];
  verbModifiers : VerbModMap = {};
  
  constructor(id : string) {
    this.id = id;
  }
  
  withVerb(verb: string) : ObjBuilder {
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

  build() : Obj {
    return new Obj(this.id, this.name, this.verbs, this.cverbs, this.verbModifiers);   
  }
}
