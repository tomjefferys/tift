
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

export class VerbMatcher {
  readonly verb : string;
  readonly attribute? : string;
  readonly qualifier : boolean;

  constructor(verb : string, attribute : string | undefined, qualifier : boolean) {
    this.verb = verb;
    this.attribute = attribute;
    this.qualifier = qualifier;
  }

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
    this.verbs.push(new VerbMatcher(verb, undefined, false));
    return this;
  }

  build() : Obj {
    return new Obj(this.id, this.name, this.verbs, this.cverbs);   
  }
}
