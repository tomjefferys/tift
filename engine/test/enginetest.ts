import { Engine } from "../src/engine";
import { EngineBuilder } from "../src/enginebuilder";
import { listOutputConsumer } from "./testutils/testutils"

let messages : string[];
let builder : EngineBuilder;
let engine : Engine;


const THE_ROOM = {
    id : "theRoom",
    name : "The Room",
    desc : "An almost empty room",
    type : "room",
    tags : [ "start" ]
};

const ORDINARY_ITEM = {
    id : "anItem",
    name : "an ordinary item",
    type : "item",
    location : "theRoom",
    tags : ["carryable"]
};

const OTHER_ITEM = {
    id : "otherItem",
    name : "another item",
    type : "item",
    location : "theRoom",
    tags : ["carryable"]
};

const YET_ANOTHER_ITEM = {
    id : "otherItem2",
    name : "another another item",
    type : "item",
    location : "theRoom",
    tags : ["carryable"]
};

const NORTH_ROOM = {
    id : "northRoom",
    type : "room",
    tags : [ "start" ]
};


beforeEach(() => {
    messages = [];
    builder = new EngineBuilder().withOutput(listOutputConsumer(messages));
});

test("Test single room, no exits", () => {
    builder.withObj(NORTH_ROOM)
    engine = builder.build();
    expectWords([], ["go", "look"]);
    expectWords(["go"], []);
    expectWords(["eat"], []);
    expect(messages).toHaveLength(0);
});

test("Test single room, with one exit", () => {
    builder.withObj({
        ...NORTH_ROOM,
        exits : {
            south : "southRoom"
        },
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
        ...NORTH_ROOM,
        exits : {
            south : "southRoom",
            east : "eastRoom"
        },
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
        ...NORTH_ROOM,
        desc : "The room is dark and square",
        exits : {
            south : "southRoom"
        },
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
    executeAndTest(["look"], { expected : ["The room is dark and square", ""]});
    
    executeAndTest(["go", "south"], {});
    executeAndTest(["look"], { expected : ["The South Room"] });
    expectWords(["go"],["north"]);
})

test("Test room with item", () => {
    builder.withObj(THE_ROOM);
    builder.withObj(ORDINARY_ITEM);
    engine = builder.build();
    engine.execute(["look"]);
    executeAndTest(["look"], { expected : ["An almost empty room", "an ordinary item"]});

    expectWords([], ["go", "look", "get"]);
})

test("Test get item", () => {
    builder.withObj(THE_ROOM);
    builder.withObj(ORDINARY_ITEM);

    engine = builder.build();
    executeAndTest(["look"], {expected : ["an ordinary item"]});
    executeAndTest(["get", "anItem"], {});
    executeAndTest(["look"], { notExpected : ["an ordinary item"]});
})

test("Test get named item", () => {
    builder.withObj(THE_ROOM);
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
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "key",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });
    engine = builder.build();
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});

    expectWords([], ["go", "look", "get"]);

    executeAndTest(["get", "key"], {});
    executeAndTest(["look"], { expected : ["An almost empty room"], notExpected : ["key"]});

    expectWords([], ["go", "look", "drop"]);
   
    executeAndTest(["drop", "key"], {});
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});
});

test("Test simple rules", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "rule1",
        type : "rule",
        run : ["print('hello world')"]
    })
    engine = builder.build();
    executeAndTest(["look"], { expected : ["An almost empty room", "hello world"]});
});

test("Test before and after actions", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "hotRock",
        name : "hot rock",
        type : "item",
        location : "theRoom",
        before : "get(this) => 'Ouch!'",
        after : "get(this) => 'Bingo!'",
        tags : ["carryable"]
    });
    builder.withObj({
        id : "coolRock",
        name : "cool rock",
        type : "item",
        location : "theRoom",
        after : "get(this) => 'Bingo!'",
        tags : ["carryable"]
    });

    engine = builder.build();
    executeAndTest(["look"], { expected : ["hot rock", "cool rock"]});
    executeAndTest(["get", "hotRock"], { expected : ["Ouch!"], notExpected : ["Bingo!"]});
    executeAndTest(["look"], { expected : ["hot rock", "cool rock"]});
    executeAndTest(["get", "coolRock"], { expected : ["Bingo!"], notExpected : ["Ouch!"]});
    executeAndTest(["look"], { expected : ["hot rock"], notExpected : ["cool rock"]});
});

test("Test before precedence", () => {
    builder.withObj({
        ...THE_ROOM,
        before : [
            "get(this) => 'cant get a room!'",
            "get($item) => 'No using wildcard gets here'",
            "get(anItem) => 'No getting the ordinary item'",
            "get(otherItem) => false",
            "get(otherItem2) => false"]
    });
    builder.withObj({
        ...ORDINARY_ITEM,
        before : [
            "get(this) => 'This item really cant be picked up'",
            "get(otherItem) => 'This inscope item can also stop other items being picked up'"
        ]
    })
    builder.withObj({
        ...OTHER_ITEM,
        after : "get(this) => 'Got the other item!'"
    })
    builder.withObj({
        ...YET_ANOTHER_ITEM,
        after : "get(this) => 'Finally something gettable'"
    })
    engine = builder.build();
     
    executeAndTest(["look"], { expected : ["an ordinary item", "another item", "another another item"]});

    executeAndTest(["get", "anItem"], { expected : ["No getting the ordinary item"]});
    executeAndTest(["look"], { expected : ["an ordinary item", "another item", "another another item"]});

    executeAndTest(["get", "otherItem"], { expected : ["This inscope item can also stop other items being picked up"]});
    executeAndTest(["look"], { expected : ["an ordinary item", "another item", "another another item"]});

    executeAndTest(["get", "otherItem2"], { expected : ["Finally something gettable"]});
    executeAndTest(["look"], { expected : ["an ordinary item", "another item"]});
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