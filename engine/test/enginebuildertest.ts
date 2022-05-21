import { makeVerb, makeEntity } from "../src/enginebuilder";
import { Obj } from "../src/types";
import { Verb, VerbTrait } from "../src/verb";


test("Test make verb from empty object", () => {
    const obj = {};
    expect(() => makeVerb(obj)).toThrowError();
});

test("Test make verb with only id", () => {
    const obj = {"id": "myverb"};
    const verb = makeVerb(obj);
    expect(verb.id).toEqual("myverb");
    expect(verb.name).toBeUndefined();
    expect(verb.attributes).toHaveLength(0);
    expect(verb.modifiers).toHaveLength(0);
});

test("Test make modifiable verb", () => {
    const obj = {
        "id": "go",
        "type": "verb",
        "modifiers": [ "direction", "speed"],
        "tags": [
          "intransitive"
        ]
      };

    const verb = makeVerb(obj);
    expect(verb.id).toEqual("go");
    expect(verb.name).toBeUndefined();
    expect(verb.attributes).toHaveLength(0);
    expect(verb.modifiers).toHaveLength(2);
    expect(verb.modifiers).toContain("direction");
    expect(verb.modifiers).toContain("speed");
    expect(verb.traits).toHaveLength(1);
    expect(verb.traits).toContain(VerbTrait.Intransitive);
});

test("Test make attributed verb", () => {
    const obj = {
        "id": "stir",
        "type": "verb",
        "attributes": [
          "with"
        ],
        "tags": [
          "transitive",
          "intransitive"
        ]
      };
    
      const verb = makeVerb(obj);
      expect(verb.id).toEqual("stir");
      expect(verb.name).toBeUndefined();
      expect(verb.modifiers).toHaveLength(0);
      expect(verb.attributes).toHaveLength(1);
      expect(verb.attributes).toContain("with");
      expect(verb.traits).toHaveLength(2);
      expect(verb.traits).toContain(VerbTrait.Intransitive);
      expect(verb.traits).toContain(VerbTrait.Transitive);
});

test("Test make simple entity", () => {
    const obj = {
        "id": "soup",
        "type": "object",
        "verbs": [
          "stir"
        ]
      };
    
    const entity = makeEntity(obj);
    expect(entity.id).toEqual("soup");
    expect(entity.verbs).toHaveLength(1);
    expect(entity.verbs).toContainEqual({"verb":"stir"});
});

test("Test entity with verb attribute", () => {
    const obj = {
        "id": "spoon",
        "type": "object",
        "verbs": [
            "stir.with"
        ]
      }

    const entity = makeEntity(obj);
    expect(entity.id).toEqual("spoon");
    expect(entity.verbs).toHaveLength(1);
    expect(entity.verbs).toContainEqual({"verb":"stir", "attribute":"with"});
});

test("Test entity with verb modifiers", () => {
    const obj =  {
        "id": "cave",
        "type": "object",
        "verbs": [
            "go"
        ],
        "modifiers": {
            "direction": [
                "north",
                "east"
            ]
        }
    }

    const entity = makeEntity(obj);
    expect(entity.id).toEqual("cave");
    expect(entity.verbs).toHaveLength(1);
    expect(entity.verbs).toContainEqual({"verb":"go"});
    expect(entity.verbModifiers).toStrictEqual({"direction":["north", "east"]});
})