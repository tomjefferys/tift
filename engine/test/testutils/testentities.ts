import { VerbBuilder } from "../../src/verb";
import { EntityBuilder } from "../../src/entity";


export const STIR = new VerbBuilder({"id":"stir"})
                     .withTrait("transitive")
                     .withTrait("indirectOptional")
                     .withAttribute("with")
                     .build();

export const EAT = new VerbBuilder({"id":"eat"})
                     .withTrait("transitive")
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
                  .withTrait("intransitive")
                  .withModifier("direction")
                  .build();

export const CAVE = new EntityBuilder({"id" : "cave"})
                  .withVerb("go")
                  .withVerb("look")
                  .withVerbModifier("direction","north")
                  .withVerbModifier("direction","east")
                  .build();

export const PUSH = new VerbBuilder({"id":"push"})
                    .withTrait("transitive")
                    .withModifier("direction")
                    .build();

export const BOX = new EntityBuilder({"id" : "box"})
                    .withVerb("push")
                    .build();

export const LOOK = new VerbBuilder({"id":"look"})
                  .withTrait("intransitive")
                  .build();

export const GET = new VerbBuilder({"id":"get"})
                  .withTrait("transitive")
                  .withContext("environment")
                  .build();

export const DROP = new VerbBuilder({"id":"drop"})
                  .withTrait("transitive")
                  .withContext("inventory")
                  .withContext("holding")
                  .build();

export const ASK = new VerbBuilder({"id":"ask"})
                  .withTrait("transitive")
                  .withAttribute("about")
                  .build();

export const BARKEEP = new EntityBuilder({"id" : "barkeep"})
                  .withVerb("ask")
                  .build();

export const BEER = new EntityBuilder({"id" : "beer"})
                  .withAttributedVerb("ask", "about")
                  .build();