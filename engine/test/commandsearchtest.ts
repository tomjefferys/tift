import {getAllCommands} from "../src/commandsearch";
import {Entity, EntityBuilder} from "../src/entity";
import {Verb, VerbBuilder, VerbTrait} from "../src/verb";

const STIR = new VerbBuilder({"id":"stir"})
                     .withTrait(VerbTrait.Transitive)
                     .withAttribute("with")
                     .build();

const EAT = new VerbBuilder({"id":"eat"})
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

const GO = new VerbBuilder({"id":"go"})
                  .withTrait(VerbTrait.Intransitive)
                  .withModifier("direction")
                  .build();

const CAVE = new EntityBuilder({"id" : "cave"})
                  .withVerb("go")
                  .withVerb("look")
                  .withVerbModifier("direction","north")
                  .withVerbModifier("direction","east")
                  .build();

const PUSH = new VerbBuilder({"id":"push"})
                    .withTrait(VerbTrait.Transitive)
                    .withModifier("direction")
                    .build();

const BOX = new EntityBuilder({"id" : "box"})
                    .withVerb("push")
                    .build();

const LOOK = new VerbBuilder({"id":"look"})
                  .withTrait(VerbTrait.Intransitive)
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
  const commands = getAllCommandIds([SOUP, APPLE], [STIR]);
  expect(commands).toHaveLength(1);
  expect(commands).toEqual(expect.arrayContaining([["stir","soup"]]));
}) 

test("Test multiple transitive verbs", () => {
  const commands = getAllCommandIds([SOUP, APPLE], [STIR, EAT]);
  expect(commands).toHaveLength(2);
  expect(commands).toEqual(expect.arrayContaining([
       ["stir","soup"],
       ["eat","apple"]]));
});

test("Test transitive verb with indirect object", () => {
  const commands = getAllCommandIds([SOUP, SPOON], [STIR]);
  expect(commands).toHaveLength(2);
  expect(commands).toEqual(expect.arrayContaining([
       ["stir","soup"],
       ["stir","soup","with","spoon"]]));
});

test("Test instransitive verb with modifier", () => {
  const commands = getAllCommandIds([CAVE], [GO]);
  expect(commands).toHaveLength(3);
  expect(commands).toEqual(expect.arrayContaining([
    ["go"],
    ["go","north"],
    ["go","east"] ]));
});

test("Test transitive verb with modifier", () => {
  const commands = getAllCommandIds([BOX, CAVE], [PUSH]);
  expect(commands).toHaveLength(3);
  expect(commands).toEqual(expect.arrayContaining([
    ["push", "box"],
    ["push", "box", "north"],
    ["push", "box", "east"]
  ]));
})

test("Test look", () => {
  const commands = getAllCommandIds([CAVE], [GO, LOOK])
  expect(commands).toHaveLength(4);
  expect(commands).toEqual(expect.arrayContaining([
    ["go"],
    ["go","north"],
    ["go","east"],
    ["look"] ]));
});

function getAllCommandIds(entities : Entity[], verbs : Verb[]) {
  const commands = getAllCommands(entities, verbs);
  return commands.map(command => command.map(idWords => idWords.id))
}
