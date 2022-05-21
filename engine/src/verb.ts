export enum VerbTrait {
  Transitive,
  Intransitive,
  Modifiable
}


export class Verb {
  readonly id : string;
  readonly name? : string;
  readonly attributes : string[];
  readonly traits : VerbTrait[];
  readonly modifiers : string[];

  constructor(id : string,
              name : string | undefined,
              attributes : string[],
              traits : VerbTrait[],
              modifiers : string[]) {
    this.id = id;
    this.name = name;
    this.attributes = attributes;
    this.traits = traits;
    this.modifiers = modifiers;
  }

  isTransitive() : boolean {
    return this.traits.includes(VerbTrait.Transitive);
  }

  isIntransitive() : boolean {
    return this.traits.includes(VerbTrait.Intransitive);
  }
  
  isModifiable() : boolean {
    return this.modifiers.length != 0;
  }

  getName() : string {
    return this.name ? this.name : this.id;
  }
}

export class VerbBuilder {
  id : string;
  name? : string;
  attributes : string[] = [];
  traits : VerbTrait[] = [];
  modifiers : string[] = [];

  constructor(id : string) {
    if (!id) {
      throw new Error("A verb must have an id");
    }
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
  
  withModifier(modifier : string) : VerbBuilder {
    this.modifiers.push(modifier);
    return this;
  }

  build() : Verb {
    return new Verb(this.id, this.name, this.attributes, this.traits, this.modifiers);
  }
  

}

