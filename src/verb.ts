export enum VerbTrait {
  Transitive,
  Intransitive,
  Qualifiable
}


export class Verb {
  readonly id : string;
  readonly name? : string;
  readonly attributes : string[];
  readonly traits : VerbTrait[];

  constructor(id : string,
              name : string | undefined,
              attributes : string[],
              traits : VerbTrait[]) {
    this.id = id;
    this.name = name;
    this.attributes = attributes;
    this.traits = traits;
  }
}

export class VerbBuilder {
  id : string;
  name? : string;
  attributes : string[] = [];
  traits : VerbTrait[] = [];

  constructor(id : string) {
    this.id = id;
  } 
  
  withName(name : string) : VerbBuilder {
    this.name = name;
    return this;
  }
  
  withAttribute(attribute : string) : VerbBuilder {
    this.attributes.push(attribute);
    return this;
  }

  withTrait(trait : VerbTrait) : VerbBuilder {
    this.traits.push(trait);
    return this;
  }

  build() : Verb {
    return new Verb(this.id, this.name, this.attributes, this.traits);
  }
  

}

