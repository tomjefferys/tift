import { compileFunctions } from "../../src/game/functionbuilder";
import { setUpEnv } from "../testutils/testutils";

test("Build rule", () => {
    const obj = {
      "id": "rule1",
      "type": "rule",
      "afterTurn()": ["write('hello')", "write('world')"]
    }
    const [env, messages] = setUpEnv();
    env.set(obj.id, obj);

    compileFunctions(undefined, obj["id"], env);
    env.get(obj.id)["afterTurn"](env);
    expect(messages).toStrictEqual(["hello", "world"]);
});

test("Build rule - single expr", () => {
    const obj = {
      "id": "rule1",
      "type": "rule",
      "afterTurn()": "write('hello world')"
    }
    const [env, messages] = setUpEnv();
    env.set(obj.id, obj);

    compileFunctions(undefined, obj["id"], env);
    env.get(obj.id)["afterTurn"](env);
    expect(messages).toStrictEqual(["hello world"]);
});

test("Build rule - error", () => {
    const obj = {
      "id": "rule1",
      "type": "rule",
      "afterTurn()": "write('hello world)"
    }

    const [env, _messages] = setUpEnv();
    env.set(obj.id, obj);

    try {
      compileFunctions(undefined, obj["id"], env);
      env.get(obj.id)["afterTurn"](env);
      expect.fail();
    } catch (e) {
      const error = e as Error;
      expect(error.message).toContain("rule1.afterTurn");
      expect(error.message).toContain("write('hello world)");
    }
});