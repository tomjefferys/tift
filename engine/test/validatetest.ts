import { EngineBuilder } from "../src/game/enginebuilder";
import { Input } from "../src/main";
import { ValidationResult } from "tift-types/src/messages/output";
import { createEngineTestEnvironment, EngineRef } from "./testutils/testutils";
import dedent from "dedent-js";

let engine : EngineRef;
let builder : EngineBuilder;
let validationResults : ValidationResult[];

beforeEach(() => {
    const testEnvironment = createEngineTestEnvironment();
    engine = testEnvironment.engine;
    builder = testEnvironment.builder;
    validationResults = testEnvironment.validationResults;
});

test("Test valid game data passes validation", () => {
    engine.ref = builder.build();

    const goodYAML = dedent(`
        room: northRoom
        tags:
          - start
        desc: A room
    `);

    engine.send(Input.validate(goodYAML));
    expect(validationResults).toHaveLength(1);
    expect(validationResults[0].valid).toBe(true);
    expect(validationResults[0].errors).toHaveLength(0);
});

test("Test invalid game data returns a structured error with location", () => {
    engine.ref = builder.build();

    const badYAML = dedent(`
        --- # file:src/foo/bar.yaml
        room: northRoom
        tags:
          - start
        afterTurn(): print("Hello)
    `);

    engine.send(Input.validate(badYAML));
    expect(validationResults).toHaveLength(1);

    const result = validationResults[0];
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe("src/foo/bar.yaml");
    expect(result.errors[0].line).toBe(4);
    expect(result.errors[0].message.length).toBeGreaterThan(0);
});

test("Test error location in nested object", () => {
    engine.ref = builder.build();

    const badYAML = dedent(`
        --- # file:src/foo/bar.yaml
        room: northRoom
        tags:
          - start
        functions:
          afterTurn(): print("Hello)
    `);

    engine.send(Input.validate(badYAML));
    const result = validationResults[0];
    expect(result.valid).toBe(false);
    expect(result.errors[0].file).toBe("src/foo/bar.yaml");
    expect(result.errors[0].line).toBe(5);
});

test("Test validating does not mutate or affect the running engine", () => {
    engine.ref = builder.build();

    const goodYAML = dedent(`
        room: northRoom
        tags:
          - start
        desc: A room
    `);
    engine.send(Input.load(goodYAML));
    engine.send(Input.start());

    engine.send(Input.getInfo());

    const badYAML = dedent(`
        room: brokenRoom
        afterTurn(): print("Hello)
    `);
    engine.send(Input.validate(badYAML));

    expect(validationResults).toHaveLength(1);
    expect(validationResults[0].valid).toBe(false);

    // The already loaded and started game should be completely unaffected
    engine.send(Input.getInfo());
    engine.send(Input.getStatus());
});

test("Test validate still works after the engine has errored", () => {
    engine.ref = builder.build();

    const badYAML = dedent(`
        room: brokenRoom
        afterTurn(): print("Hello)
    `);
    engine.send(Input.load(badYAML));

    const goodYAML = dedent(`
        room: northRoom
        tags:
          - start
        desc: A room
    `);
    engine.send(Input.validate(goodYAML));

    expect(validationResults).toHaveLength(1);
    expect(validationResults[0].valid).toBe(true);
});
