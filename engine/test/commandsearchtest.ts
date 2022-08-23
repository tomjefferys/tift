import {getAllCommands, ContextEntities, searchNext, searchExact, SearchContext } from "../src/commandsearch";
import {Command} from "../src/command"
import {Entity, EntityBuilder} from "../src/entity";
import {Verb, VerbBuilder} from "../src/verb";
import * as _ from "lodash"
import { VerbMap } from "../src/types";

const STIR = new VerbBuilder({"id":"stir"})
                     .withTrait("transitive")
                     .withAttribute("with")
                     .build();

const EAT = new VerbBuilder({"id":"eat"})
                     .withTrait("transitive")
                     .build();

const SOUP = new EntityBuilder({"id" : "soup"})
                    .withVerb("stir")
                    .build();
  
const APPLE = new EntityBuilder({"id" : "apple"})
                     .withVerb("eat")
                     .withVerb("get")
                     .withVerb("drop")
                     .build();

const SPOON = new EntityBuilder({"id" : "spoon"})
                     .withAttributedVerb("stir","with")
                     .build();

const GO = new VerbBuilder({"id":"go"})
                  .withTrait("intransitive")
                  .withModifier("direction")
                  .build();

const CAVE = new EntityBuilder({"id" : "cave"})
                  .withVerb("go")
                  .withVerb("look")
                  .withVerbModifier("direction","north")
                  .withVerbModifier("direction","east")
                  .build();

const PUSH = new VerbBuilder({"id":"push"})
                    .withTrait("transitive")
                    .withModifier("direction")
                    .build();

const BOX = new EntityBuilder({"id" : "box"})
                    .withVerb("push")
                    .build();

const LOOK = new VerbBuilder({"id":"look"})
                  .withTrait("intransitive")
                  .build();

const GET = new VerbBuilder({"id":"get"})
                  .withTrait("transitive")
                  .withContext("environment")
                  .build();

const DROP = new VerbBuilder({"id":"drop"})
                  .withTrait("transitive")
                  .withContext("inventory")
                  .withContext("holding")
                  .build();

test("Test empty input", () => {
  const options = getAllCommandIds([], []);
  expect(options).toHaveLength(0);
})

test("Test no objects", () => {
  const options = getAllCommandIds([], [STIR]);
  expect(options).toHaveLength(0);
})

test("Test no verbs", () => {
  const options = getAllCommandIds([SOUP, APPLE], []);
  expect(options).toHaveLength(0);
})

test("No matching verbs and objects", () => {
  const options = getAllCommandIds([APPLE], [STIR]);
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

test("Test inventory context", () => {
  let commands = getAllCommandIds({"environment":[APPLE]}, [GET, DROP]);
  expect(commands).toHaveLength(1);
  expect(commands).toEqual(expect.arrayContaining([["get", "apple"]]));

  commands = getAllCommandIds({"inventory":[APPLE]}, [GET, DROP]);
  expect(commands).toHaveLength(1);
  expect(commands).toEqual(expect.arrayContaining([["drop", "apple"]]));
});

test("Test partial search", () => {
  const context : SearchContext = {
    objs : {"default" : [BOX, CAVE]},
    verbs : createVerbMap([PUSH, GO])
  }

  let next = searchNext([], context);
  expect(getCommandWords(next)).toStrictEqual([["go"], ["push"]]);

  next = searchNext(["push"], context);
  expect(getCommandWords(next)).toStrictEqual([["push", "box"]]);

  next = searchNext(["push", "box"], context);
  expect(getCommandWords(next)).toEqual(expect.arrayContaining([["push", "box", "north"], ["push", "box", "east"]]));
});

test("Test exact search", () => {
  const context : SearchContext = {
    objs : {"default" : [BOX, CAVE]},
    verbs : createVerbMap([PUSH])
  }

  let exact = searchExact([], context);
  expect(exact).toBeUndefined();

  exact = searchExact(["push"], context);
  expect(exact).toBeUndefined();

  exact = searchExact(["push", "box"], context);
  expect(exact).not.toBeUndefined();
  expect(getCommandWords([exact as Command])).toEqual(expect.arrayContaining([["push", "box"]]));

  exact = searchExact(["push", "box", "north"], context);
  expect(exact).not.toBeUndefined();
  expect(getCommandWords([exact as Command])).toEqual(expect.arrayContaining([["push", "box", "north"]]));
})

const createVerbMap = (verbs : Verb[]) : VerbMap => verbs.reduce((obj, verb) => ({...obj, [verb.id] : verb}), {});

const getCommandWords = (states : Command[]) : string[][] => states.map(state => state.getWords().map(wordId => wordId.id));

function getAllCommandIds(entities : ContextEntities | Entity[], verbs : Verb[]) {
  const contextEntities = _.isArray(entities)? {"default": entities} : entities;
  const commands = getAllCommands(contextEntities, verbs);
  return commands.map(command => command.map(idWords => idWords.id))
}
