import {getAllCommands} from "../src/commandsearch";
import {Entity, EntityBuilder} from "../src/entity";
import {Verb, VerbBuilder, VerbTrait} from "../src/verb";

const STIR = new VerbBuilder("stir")
                     .withTrait(VerbTrait.Transitive)
                     .withAttribute("with")
                     .build();

const EAT = new VerbBuilder("eat")
                     .withTrait(VerbTrait.Transitive)
                     .build();

const SOUP = new EntityBuilder({"id" : "soup"})
                    .withVerb("stir")
                    .build();
  
const APPLE = new EntityBuilder({"id" : "apple"})
                     .withVerb("eat")
                     .build();

const SPOON = new EntityBuilder({"id" : "spoon"})
                     .withAttributedVerb("stir","with")
                     .build();

const GO = new VerbBuilder("go")
                  .withTrait(VerbTrait.Intransitive)
                  .withModifier("direction")
                  .build();

const CAVE = new EntityBuilder({"id" : "cave"})
                  .withVerb("go")
                  .withVerbModifier("direction","north")
                  .withVerbModifier("direction","east")
                  .build();

const PUSH = new VerbBuilder("push")
                    .withTrait(VerbTrait.Transitive)
                    .withModifier("direction")
                    .build();

const BOX = new EntityBuilder({"id" : "box"})
                    .withVerb("push")
                    .build();

test("Test empty input", () => {
  const options = getAllCommands([], []);
  expect(options).toHaveLength(0);
})

test("Test no objects", () => {
  const options = getAllCommands([], [STIR]);
  expect(options).toHaveLength(0);
})

test("Test no verbs", () => {
  const options = getAllCommands([SOUP, APPLE], []);
  expect(options).toHaveLength(0);
})

test("No matching verbs and objects", () => {
  const options = getAllCommands([APPLE], [STIR]);
  expect(options).toHaveLength(0);
})

test("Test simple transitive verb", () => { 
  const commands = getAllCommands([SOUP, APPLE], [STIR]);
  expect(commands).toHaveLength(1);
  expect(commands).toEqual(expect.arrayContaining([["stir","soup"]]));
}) 

test("Test multiple transitive verbs", () => {
  const commands = getAllCommands([SOUP, APPLE], [STIR, EAT]);
  expect(commands).toHaveLength(2);
  expect(commands).toEqual(expect.arrayContaining([
       ["stir","soup"],
       ["eat","apple"]]));
});

test("Test transitive verb with indirect object", () => {
  const commands = getAllCommands([SOUP, SPOON], [STIR]);
  expect(commands).toHaveLength(2);
  expect(commands).toEqual(expect.arrayContaining([
       ["stir","soup"],
       ["stir","soup","with","spoon"]]));
});

test("Test instransitive verb with modifier", () => {
  const commands = getAllCommands([CAVE], [GO]);
  expect(commands).toHaveLength(3);
  expect(commands).toEqual(expect.arrayContaining([
    ["go"],
    ["go","north"],
    ["go","east"] ]));
});

test("Test transitive verb with modifier", () => {
  const commands = getAllCommands([BOX, CAVE], [PUSH])
  expect(commands).toHaveLength(3);
  expect(commands).toEqual(expect.arrayContaining([
    ["push", "box"],
    ["push", "box", "north"],
    ["push", "box", "east"]
  ]));
})

