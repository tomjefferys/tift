import {getWordOptions, getAllCommands, WordOption} from "../src/commandsearch";
import {Obj, ObjBuilder} from "../src/obj";
import {Verb, VerbBuilder, VerbTrait} from "../src/verb";

const STIR = new VerbBuilder("stir")
                     .withTrait(VerbTrait.Transitive)
                     .withAttribute("with")
                     .build();

const EAT = new VerbBuilder("eat")
                     .withTrait(VerbTrait.Transitive)
                     .build();

const SOUP = new ObjBuilder("soup")
                    .withVerb("stir")
                    .build();
  
const APPLE = new ObjBuilder("apple")
                     .withVerb("eat")
                     .build();

const SPOON = new ObjBuilder("spoon")
                     .withAttributedVerb("stir","with")
                     .build();

const GO = new VerbBuilder("go")
                  .withTrait(VerbTrait.Intransitive)
                  .withModifier("direction")
                  .build();

const CAVE = new ObjBuilder("cave")
                  .withVerb("go")
                  .withVerbModifier("direction","north")
                  .withVerbModifier("direction","east")
                  .build();

test("Test empty input", () => {
  const options = getWordOptions([], []);
  expect(options).toHaveLength(0);
})

test("Test no objects", () => {
  const options = getWordOptions([], [STIR]);
  expect(options).toHaveLength(0);
})

test("Test no verbs", () => {
  const options = getWordOptions([SOUP, APPLE], []);
  expect(options).toHaveLength(0);
})

test("No matching verbs and objects", () => {
  const options = getWordOptions([APPLE], [STIR]);
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
  expect(commands).toHaveLength(2);
  expect(commands).toEqual(expect.arrayContaining([
    ["go","north"],
    ["go","east"] ]));
});

