import { Log } from "tift-types/src/messages/output";
import { EngineBuilder } from "../src/game/enginebuilder";
import { Input } from "../src/main";
import { Obj } from "../src/util/objects";
import { createEngineTestEnvironment, EngineRef, ExpectStatusFn, ExpectWordsFn } from "./testutils/testutils";
import dedent from "dedent-js";

let log : Log[];
let engine : EngineRef;
let builder : EngineBuilder;
let info : Obj;
let expectWords : ExpectWordsFn;
let expectStatus : ExpectStatusFn;

beforeEach(() => {
    const testEnvironment = createEngineTestEnvironment();
    engine = testEnvironment.engine;
    log = testEnvironment.log;
    info = testEnvironment.info;
    builder = testEnvironment.builder;
    expectWords = testEnvironment.expectWords;
    expectStatus = testEnvironment.expectStatus;
});

test("Test no start if error on load", () => {
    engine.ref = builder.build();   
    const badYAML = dedent(`
        room: northRoom
        tags:
          - start
        afterTurn(): print("Hello)
    `);
    
    engine.send(Input.load(badYAML));
    expect(log).toHaveLength(1);  
    expect(log[0].level).toBe("error");
    
    expect(log[0].message).toContain("unknown:4");

    // Already errored once should be no new messages
    engine.send(Input.start());
    expect(log).toHaveLength(1);  

    // Don't expect any words
    expectWords([], []);

    engine.send(Input.getInfo());
    expect(info["Errored"]).toBeTruthy();

    expectStatus({"title": "error"});
});

test("Test error message with filename", () => {
    engine.ref = builder.build();   
    const badYAML = dedent(`
        --- # file:src/foo/bar.yaml
        room: northRoom
        tags:
          - start
        afterTurn(): print("Hello)
    `);
    
    engine.send(Input.load(badYAML));
    expect(log).toHaveLength(1);  
    expect(log[0].level).toBe("error");
    
    expect(log[0].message).toContain("src/foo/bar.yaml:4");
});

test("Test error in second document", () => {
    engine.ref = builder.build();   
    const badYAML = dedent(`
        --- # file:/src/foo/bar.yaml
        room: southRoom
        tags:
          - start
        afterTurn(): print("Hello")
        --- # file:src/baz/qux.yaml
        room: northRoom
        afterTurn(): print("Goodbye)
    `);
    
    engine.send(Input.load(badYAML));
    expect(log).toHaveLength(1);  
    expect(log[0].level).toBe("error");
    
    expect(log[0].message).toContain("src/baz/qux.yaml:2");
});

test("Test error in nested object", () => {
    engine.ref = builder.build();   
    const badYAML = dedent(`
        --- # file:src/foo/bar.yaml
        room: northRoom
        tags:
          - start
        functions:
          afterTurn(): print("Hello)
    `);
    
    engine.send(Input.load(badYAML));
    expect(log).toHaveLength(1);  
    expect(log[0].level).toBe("error");
    
    expect(log[0].message).toContain("src/foo/bar.yaml:5");
});

test("Test error handing in doubly nested object", () => { 
    engine.ref = builder.build();   
    const badYAML = dedent(`
        --- # file:src/foo/bar.yaml
        room: northRoom
        tags:
          - start
        functions:
          turnFunctions:
            afterTurn(): print("Hello)
    `);
    
    engine.send(Input.load(badYAML));
    expect(log).toHaveLength(1);  
    expect(log[0].level).toBe("error");
    
    expect(log[0].message).toContain("src/foo/bar.yaml:6");
});

test("Test error handling with bad tags list", () => {
  engine.ref = builder.build();
  const badYAML = dedent(`
    --- # file:src/foo/bar.yaml
    verb: fuddle
    tags: transitive
    myFunc(): print("Hello)
  `);

    engine.send(Input.load(badYAML));
    expect(log).toHaveLength(1);  
    expect(log[0].level).toBe("error");
    
    expect(log[0].message).toContain("src/foo/bar.yaml:2");
});

test("Test error handling in verb", () => {
  engine.ref = builder.build();
  const badYAML = dedent(`
    --- # file:src/foo/bar.yaml
    verb: fuddle
    tags: [transitive]
    myFunc(): print("Hello)
  `);

    engine.send(Input.load(badYAML));
    expect(log).toHaveLength(1);  
    expect(log[0].level).toBe("error");
    
    expect(log[0].message).toContain("src/foo/bar.yaml:3");
});