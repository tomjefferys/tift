import {getAllCommands, ContextEntities, searchExact, SearchContext, search } from "../src/commandsearch";
import {Command} from "../src/command"
import { Entity } from "../src/entity";
import { Verb } from "../src/verb";
import { createRootEnv } from "../src/env";
import * as _ from "lodash"
import { VerbMap } from "../src/types";
import { EAT, APPLE, STIR, SOUP, SPOON, LOOK, ASK,
         BARKEEP, GO, CAVE, PUSH, BOX, GET, DROP, CHAIR, STAND, SIT, BALL, BAG, PUT, BED, LIE } from "./testutils/testentities"
import * as SearchTerm from "../src/searchterm";

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

test("Test intransitive verb with attribute and object", () => {
  const command = getAllCommandIds([BED], [LIE]);
  expect(command).toHaveLength(1);
  expect(command).toEqual([["lie","on","bed"]]);
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

test("Test put", () => {
    const commands = getAllCommandIds([BALL, BAG], [PUT]);
    expect(commands).toHaveLength(1);
    expect(commands).toEqual(expect.arrayContaining([["put", "ball", "in", "bag"]]));
})

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
    verbs : createVerbMap([PUSH, GO]),
    env : createRootEnv({})
  }

  let next = search(SearchTerm.fromStrings("?"), context);
  expect(getCommandWords(next)).toStrictEqual([["go"], ["push"]]);

  next = search(SearchTerm.fromStrings("push", "?"), context);
  expect(getCommandWords(next)).toStrictEqual([["push", "box"]]);

  next = search(SearchTerm.fromStrings("push", "box", "?"), context);
  expect(getCommandWords(next)).toEqual(expect.arrayContaining([["push", "box", "north"], ["push", "box", "east"]]));
});

test("Test partial search with missing indirect object", () => {
  const noBeerContext : SearchContext = {
    objs : {"default" : [BARKEEP]},
    verbs : createVerbMap([ASK]),
    env : createRootEnv({})
  }

  let next = search(SearchTerm.fromStrings("?"), noBeerContext);
  expect(getCommandWords(next)).toHaveLength(0);

  next = search(SearchTerm.fromStrings("ask", "?"), noBeerContext);
  expect(getCommandWords(next)).toHaveLength(0);

  next = search(SearchTerm.fromStrings("ask", "barkeep", "?"), noBeerContext);
  expect(getCommandWords(next)).toHaveLength(0);
});

test("Test exact search", () => {
  const context : SearchContext = {
    objs : {"default" : [BOX, CAVE]},
    verbs : createVerbMap([PUSH]),
    env : createRootEnv({})
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

test("Test conditional verbs", () => {
  const chair = {...CHAIR};
  const context : SearchContext = {
    objs : {"default" : [chair]},
    verbs : createVerbMap([SIT, STAND]),
    env : createRootEnv({})
  }

  let next = search(SearchTerm.fromStrings("?"), context);
  let commands = getCommandWords(next);
  expect(commands).toHaveLength(1);
  expect(commands[0]).toEqual(["sit"]);

  chair.sat_on = true;

  next = search(SearchTerm.fromStrings("?"), context);
  commands = getCommandWords(next);
  expect(commands).toHaveLength(1);
  expect(commands[0]).toEqual(["stand"]);
});

test("Test wildcard verb search", () => {
  const context = {
    objs : {"default" : [APPLE, SOUP]},
    verbs : createVerbMap([EAT, STIR]),
    env : createRootEnv({})
  }
  const matches = search(SearchTerm.fromStrings("?", "apple"), context);
  expect(getCommandWords(matches)).toEqual(expect.arrayContaining([["eat", "apple"]]));
});

test("Test wildcard object search", () => {
  const context = {
    objs : {"default" : [APPLE, SOUP]},
    verbs : createVerbMap([EAT, STIR]),
    env : createRootEnv({})
  }
  const matches = search(SearchTerm.fromStrings("eat", "?"), context);
  expect(getCommandWords(matches)).toEqual(expect.arrayContaining([["eat", "apple"]]));
});

test("Test wildcard verb and object search", () => {
  const context = {
    objs : {"default" : [APPLE, SOUP]},
    verbs : createVerbMap([EAT, STIR]),
    env : createRootEnv({})
  }
  const matches = search(SearchTerm.fromStrings("?", "?"), context);
  expect(getCommandWords(matches)).toEqual(expect.arrayContaining([["eat", "apple"], ["stir", "soup"]]));
});

test("Test wildcard verb and object search with missing object", () => {
  const context = {
    objs : {"default" : [APPLE, SOUP]},
    verbs : createVerbMap([EAT, STIR]),
    env : createRootEnv({})
  }
  const matches = search(SearchTerm.fromStrings("?", "spoon"), context);
  expect(getCommandWords(matches)).toHaveLength(0);
});

test("Test wildcard verb only search", () => {
  const context = {
    objs : {"default" : [APPLE, SOUP]},
    verbs : createVerbMap([EAT, STIR]),
    env : createRootEnv({})
  }
  const matches = search(SearchTerm.fromStrings("?"), context);
  expect(getCommandWords(matches)).toEqual(expect.arrayContaining([["eat"], ["stir"]]));
});

const createVerbMap = (verbs : Verb[]) : VerbMap => verbs.reduce((obj, verb) => ({...obj, [verb.id] : verb}), {});

const getCommandWords = (states : Command[]) : string[][] => states.map(state => state.getWords().map(wordId => wordId.id));

function getAllCommandIds(entities : ContextEntities | Entity[], verbs : Verb[]) {
  const contextEntities = _.isArray(entities)? {"default": entities} : entities;
  const commands = getAllCommands(contextEntities, verbs, createRootEnv({}));
  return commands.map(command => command.map(idWords => idWords.id))
}
