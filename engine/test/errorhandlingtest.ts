import { Log } from "tift-types/src/messages/output";
import { EngineBuilder } from "../src/game/enginebuilder";
import { Input } from "../src/main";
import { Obj } from "../src/util/objects";
import { createEngineTestEnvironment, EngineRef, ExpectStatusFn, ExpectWordsFn } from "./testutils/testutils";

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
    const badYAML = `
    room: northRoom
    tags:
      - start
    afterTurn(): print("Hello)
    `;
    
    engine.send(Input.load(badYAML));
    expect(log).toHaveLength(1);  
    expect(log[0].level).toBe("error");

    // Already errored once should be no new messages
    engine.send(Input.start());
    expect(log).toHaveLength(1);  

    // Don't expect any words
    expectWords([], []);

    engine.send(Input.getInfo());
    expect(info["Errored"]).toBeTruthy();

    expectStatus({"title": "error"});
})