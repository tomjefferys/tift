import { Engine } from "../src/engine";
import { EngineBuilder } from "../src/enginebuilder";
import { listOutputConsumer } from "./testutils/testutils"

let messages : string[];
let builder : EngineBuilder;
let engine : Engine;

beforeEach(() => {
    messages = [];
    builder = new EngineBuilder().withOutput(listOutputConsumer(messages));
});

test("Test single room, no exits", () => {
    builder.withObj({
        id : "northRoom",
        type : "room",
        tags : [ "start" ]
    })
    engine = builder.build();
    expectWords([], ["go", "look"]);
    expectWords(["go"], []);
    expectWords(["eat"], []);
    expect(messages).toHaveLength(0);
});

test("Test single room, with one exit", () => {
    builder.withObj({
        id : "northRoom",
        type : "room",
        exits : {
            south : "southRoom"
        },
        tags : [ "start" ]
    })
    engine = builder.build();
    expectWords([], ["go", "look"]);
    expectWords(["go"], ["south"]);
    expectWords(["go", "south"], []);
    expectWords(["eat"], []);
    expect(messages).toHaveLength(0);
})

test("Test single room, with two exits", () => {
    builder.withObj({
        id : "northRoom",
        type : "room",
        exits : {
            south : "southRoom",
            east : "eastRoom"
        },
        tags : [ "start" ]
    })
    engine = builder.build();
    expectWords([], ["go", "look"]);
    expectWords(["go"],["south", "east"]);
    expectWords(["go", "south"], []);
    expectWords(["go", "east"], []);
    expectWords(["eat"], []);
    expect(messages).toHaveLength(0);
})

test("Test two rooms", () => {
    builder.withObj({
        id : "northRoom",
        name : "The North Room",
        desc : "The room is dark and square",
        type : "room",
        exits : {
            south : "southRoom"
        },
        tags : [ "start" ]
    })
    builder.withObj({
        id : "southRoom",
        name : "The South Room",
        type : "room",
        exits : {
            north : "northRoom"
        }
    })
    engine = builder.build();

    expectWords(["go"],["south"]);
    executeAndTest(["look"], { expected : ["The room is dark and square", "<br/>"]});
    
    executeAndTest(["go", "south"], {});
    executeAndTest(["look"], { expected : ["The South Room"] });
    expectWords(["go"],["north"]);
})

test("Test room with item", () => {
    builder.withObj({
        id : "theRoom",
        name : "The Room",
        desc : "An almost empty room",
        type : "room",
        tags : [ "start" ]
    });
    builder.withObj({
        id : "anItem",
        name : "an ordinary item",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });
    engine = builder.build();
    engine.execute(["look"]);
    executeAndTest(["look"], { expected : ["An almost empty room", "an ordinary item"]});

    expectWords([], ["go", "look", "get"]);
})

test("Test get item", () => {
    builder.withObj({
        id : "theRoom",
        name : "The Room",
        desc : "An almost empty room",
        type : "room",
        tags : [ "start" ]
    });
    builder.withObj({
        id : "anItem",
        name : "an ordinary item",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });

    engine = builder.build();
    executeAndTest(["look"], {expected : ["an ordinary item"]});
    executeAndTest(["get", "anItem"], {});
    executeAndTest(["look"], { notExpected : ["an ordinary item"]});
})

test("Test get named item", () => {
    builder.withObj({
        id : "theRoom",
        name : "The Room",
        desc : "An almost empty room",
        type : "room",
        tags : [ "start" ]
    });
    builder.withObj({
        id : "key",
        name : "rusty key",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });
    engine = builder.build();
    executeAndTest(["look"], { expected : ["rusty key"]});

    expectWords(["get"], ["key"]);

    executeAndTest(["get", "key"], {});
    executeAndTest(["look"], { notExpected : ["rusty key"]});
})

test("Test get/drop", () => {
    builder.withObj({
        id : "theRoom",
        type : "room",
        tags : [ "start" ]
    });
    builder.withObj({
        id : "key",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });
    engine = builder.build();
    executeAndTest(["look"], { expected : ["theRoom", "key"]});

    expectWords([], ["go", "look", "get"]);

    executeAndTest(["get", "key"], {});
    executeAndTest(["look"], { expected : ["theRoom"], notExpected : ["key"]});

    expectWords([], ["go", "look", "drop"]);
   
    executeAndTest(["drop", "key"], {});
    executeAndTest(["look"], { expected : ["theRoom", "key"]});
});

test("Test simple rules", () => {
    builder.withObj({
        id : "theRoom",
        type : "room",
        tags : [ "start" ]
    });
    builder.withObj({
        id : "rule1",
        type : "rule",
        run : ["print('hello world')"]
    })
    engine = builder.build();
    executeAndTest(["look"], { expected : ["theRoom", "hello world"]});
});

test("Test before action", () => {
    builder.withObj({
        id : "theRoom",
        name : "The Room",
        desc : "An almost empty room",
        type : "room",
        tags : [ "start" ]
    });
    builder.withObj({
        id : "hotRock",
        name : "hot rock",
        type : "item",
        location : "theRoom",
        before : "get(hotRock) => 'Ouch!'",
        tags : ["carryable"]
    });
    builder.withObj({
        id : "coolRock",
        name : "cool rock",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });

    engine = builder.build();
    executeAndTest(["look"], { expected : ["hot rock", "cool rock"]});
    executeAndTest(["get", "hotRock"], { expected : ["Ouch!"]});
    executeAndTest(["look"], { expected : ["hot rock", "cool rock"]});
    executeAndTest(["get", "coolRock"], { notExpected : ["Ouch!"]});
    executeAndTest(["look"], { expected : ["hot rock"], notExpected : ["cool rock"]});
});

interface ExpectedStrings {
    expected? : string[],
    notExpected? : string[]
}

function executeAndTest(command : string[], expectedMessages : ExpectedStrings) {
    engine.execute(command);
    expectedMessages.expected?.forEach(str => {
        expect(messages).toContain(str);
    })
    expectedMessages.notExpected?.forEach(str => {
        expect(messages).not.toContain(str);
    })
    messages.length = 0;
} 

function expectWords(command : string[], expectedNextWords : string[]) {
    const words = getWordIds(engine, (command));
    expect(words).toHaveLength(expectedNextWords.length);
    expect(words).toEqual(expect.arrayContaining(expectedNextWords));
}

function getWordIds(engine : Engine, partial : string[]) : string[] {
    return engine.getWords(partial).map(idWord => idWord.id);
}