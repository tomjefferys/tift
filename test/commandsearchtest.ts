import {getWordOptions, WordOption} from "../src/commandsearch";
import {Obj, ObjBuilder} from "../src/obj";
import {Verb, VerbBuilder, VerbTrait} from "../src/verb";

test("Test simple verb", () => { 
  const stir = new VerbBuilder("stir")
                     .withTrait(VerbTrait.Intransitive)
                     .build();

  const soup = new ObjBuilder("soup")
                    .withVerb("stir");

  const options = getWordOptions([soup], [stir]);
  
  expect(options).toHaveLength(1);
  expect(options[0].word).toBe("stir");

}) 

