
export class Obj {
  readonly id : string;
  readonly name? : string;
  readonly verbs : VerbMatcher[];
  readonly cverbs : VerbMatcher[];

  constructor(id : string, 
              name : string | undefined,
              verbs : VerbMatcher[],
              cverbs : VerbMatcher[]) {
     this.id = id;
     this.name = name;
     this.verbs = verbs;
     this.cverbs = cverbs;
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

  build() : Obj {
    return new Obj(this.id, this.name, this.verbs, this.cverbs);   
  }
}
