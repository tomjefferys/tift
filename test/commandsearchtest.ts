import {getWordOptions, WordOption} from "../src/commandsearch";
import {Obj, ObjBuilder} from "../src/obj";
import {Verb, VerbBuilder, VerbTrait} from "../src/verb";

const STIR = new VerbBuilder("stir")
                     .withTrait(VerbTrait.Transitive)
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
  const options = getWordOptions([SOUP, APPLE], [STIR]);
  
  expect(options).toHaveLength(1);
  expect(options[0].word).toBe("stir");

  const objOptions = options[0].getNextWordOptions();
  expect(objOptions).toHaveLength(1);
  expect(objOptions[0].word).toBe("soup");

}) 

test("Test multiple transitive verbs", () => {

  const options = getWordOptions([SOUP, APPLE], [STIR, EAT]);
  
  expect(options).toHaveLength(2);
  
  const stirMatch = options.find(option => option.word === "stir");
  
  expect(stirMatch).toBeDefined();
  expect(stirMatch!.getNextWordOptions()
                  .map(match => match.word)).toStrictEqual(["soup"]);


  const eatMatch = options.find(option => option.word === "eat");

  expect(eatMatch).toBeDefined();
  expect(eatMatch!.getNextWordOptions()
                 .map(match => match.word)).toStrictEqual(["apple"]);

});

