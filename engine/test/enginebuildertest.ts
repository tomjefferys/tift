import { makeVerb, makeEntity, makeRoom, loadFromYaml, makeRule } from "../src/enginebuilder";
import { setUpEnv } from "./testutils/testutils"
import { EnvFn } from "../src/env"
import * as fs from "fs";
import _ from "lodash";


test("Test make verb from empty object", () => {
    const obj = {};
    expect(() => makeVerb(obj)).toThrowError();
});

test("Test make verb with only id", () => {
    const obj = {"id": "myverb"};
    const verb = makeVerb(obj);
    expect(verb.id).toEqual("myverb");
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
    expect(verb.attributes).toHaveLength(0);
    expect(verb.modifiers).toHaveLength(2);
    expect(verb.modifiers).toContain("direction");
    expect(verb.modifiers).toContain("speed");
    expect(verb.traits).toHaveLength(1);
    expect(verb.traits).toContain("intransitive");
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
      expect(verb.modifiers).toHaveLength(0);
      expect(verb.attributes).toHaveLength(1);
      expect(verb.attributes).toContain("with");
      expect(verb.traits).toHaveLength(2);
      expect(verb.traits).toContain("intransitive");
      expect(verb.traits).toContain("transitive");
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

test("Test YAML loading", () => {
  const data = fs.readFileSync("test/resources/test.yaml", "utf8");
  const engine = loadFromYaml(data, _msg => undefined);
  expect(Object.values(engine.getVerbs())).toHaveLength(5);
  expect(Object.values(engine.getEntities())).toHaveLength(3);
})

test("Build room", () => {
    const obj = {
        "id": "cave",
        "type": "room",
        "desc": "A dark dank cave",
        "exits": {
            "north": "entrance",
            "east": "pool"
        }
    };
    const room = makeRoom(obj);

    expect(room.id).toEqual("cave");
    expect(room.verbs).toHaveLength(2);
    expect(room.verbs).toContainEqual({"verb":"go"});
    expect(room.verbs).toContainEqual({"verb":"look"});
    expect(room.verbModifiers).toStrictEqual({"direction":["north", "east"]});
})

test("Build rule", () => {
    const obj = {
      "id": "rule1",
      "type": "rule",
      "run": ["write('hello')", "write('world')"]
    }

    const rule = makeRule(obj);
    const [env, messages] = setUpEnv();
    rule["__COMPILED__"].forEach((expr : EnvFn) => expr(env))
    expect(messages).toStrictEqual(["hello", "world"]);
});

test("Build rule - single expr", () => {
    const obj = {
      "id": "rule1",
      "type": "rule",
      "run": "write('hello world')"
    }

    const rule = makeRule(obj);
    const [env, messages] = setUpEnv();
    rule["__COMPILED__"].forEach((expr : EnvFn) => expr(env))
    expect(messages).toStrictEqual(["hello world"]);
});

test("Build rule - no expressions", () => {
    const obj = {
      "id": "rule1",
      "type": "rule",
    }

    expect(() => makeRule(obj)).toThrowError();
});

test("Build rule - error", () => {
    const obj = {
      "id": "rule1",
      "type": "rule",
      "run": "write('hello world)"
    }

    try {
      makeRule(obj);
      fail();
    } catch (e) {
      const error = e as Error;
      expect(error.message).toContain("rule1.run[0]");
      expect(error.message).toContain("write('hello world)");
    }

});