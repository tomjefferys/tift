import { VerbBuilder, VerbTrait } from "../../src/verb";
import { EntityBuilder } from "../../src/entity";


export const STIR = new VerbBuilder({"id":"stir"})
                     .withTrait(VerbTrait.Transitive)
                     .withAttribute("with")
                     .build();

export const EAT = new VerbBuilder({"id":"eat"})
                     .withTrait(VerbTrait.Transitive)
                     .build();

export const SOUP = new EntityBuilder({"id" : "soup"})
                    .withVerb("stir")
                    .build();
  
export const APPLE = new EntityBuilder({"id" : "apple"})
                     .withVerb("eat")
                     .withVerb("get")
                     .withVerb("drop")
                     .build();

export const SPOON = new EntityBuilder({"id" : "spoon"})
                     .withAttributedVerb("stir","with")
                     .build();

export const GO = new VerbBuilder({"id":"go"})
                  .withTrait(VerbTrait.Intransitive)
                  .withModifier("direction")
                  .build();

export const CAVE = new EntityBuilder({"id" : "cave"})
                  .withVerb("go")
                  .withVerb("look")
                  .withVerbModifier("direction","north")
                  .withVerbModifier("direction","east")
                  .build();

export const PUSH = new VerbBuilder({"id":"push"})
                    .withTrait(VerbTrait.Transitive)
                    .withModifier("direction")
                    .build();

export const BOX = new EntityBuilder({"id" : "box"})
                    .withVerb("push")
                    .build();

export const LOOK = new VerbBuilder({"id":"look"})
                  .withTrait(VerbTrait.Intransitive)
                  .build();

export const GET = new VerbBuilder({"id":"get"})
                  .withTrait(VerbTrait.Transitive)
                  .withContext("environment")
                  .build();

export const DROP = new VerbBuilder({"id":"drop"})
                  .withTrait(VerbTrait.Transitive)
                  .withContext("inventory")
                  .withContext("holding")
                  .build();