import { Engine } from "../src/engine";
import { EngineBuilder } from "../src/enginebuilder";
import { listOutputConsumer, SaveData } from "./testutils/testutils";
import { Input } from "../src/main";
import _ from "lodash";

let messages : string[];
let wordsResponse : string[];
let saveData : SaveData;
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

const SOUTH_ROOM = {
    id : "southRoom",
    type : "room"
}


beforeEach(() => {
    messages = [];
    wordsResponse = [];
    saveData = { data : [] };
    builder = new EngineBuilder().withOutput(listOutputConsumer(messages, wordsResponse, saveData));
});

test("Test single room, no exits", () => {
    builder.withObj(NORTH_ROOM)
    engine = builder.build();
    engine.send(Input.start());

    expectWords([], ["go", "look", "wait"]);
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
    engine.send(Input.start());

    expectWords([], ["go", "look", "wait"]);
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
    engine.send(Input.start());

    expectWords([], ["go", "look", "wait"]);
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
        ...SOUTH_ROOM,
        name : "The South Room",
        exits : {
            north : "northRoom"
        }
    })
    engine = builder.build();
    engine.send(Input.start());

    expectWords(["go"],["south"]);
    executeAndTest(["look"], { expected : ["The room is dark and square", ""]});
    
    executeAndTest(["go", "south"], {});
    executeAndTest(["look"], { expected : ["The South Room"] });
    expectWords(["go"],["north"]);
})

test("Test auto look", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        desc : "The room is dark and square",
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        desc : "The room is light and round",
        exits : {
            north : "northRoom"
        }
    })
    engine = builder.build();
    engine.send(Input.config({"autoLook" : true }));
    engine.send(Input.start());

    expect(messages.join()).toContain("The room is dark and square");
    messages.length = 0;

    executeAndTest(["go", "south"], { expected : [ "The room is light and round" ] })
    executeAndTest(["go", "north"], { expected : [ "**The North Room**" ] })
    executeAndTest(["go", "south"], { expected : [ "**The South Room**" ] })
})

test("Test room with item", () => {
    builder.withObj(THE_ROOM);
    builder.withObj(ORDINARY_ITEM);
    engine = builder.build();
    engine.send(Input.start());
    
    engine.send(Input.execute(["look"]));
    executeAndTest(["look"], { expected : ["An almost empty room", "an ordinary item"]});

    expectWords([], ["go", "look", "get", "wait"]);
})

test("Test get item", () => {
    builder.withObj(THE_ROOM);
    builder.withObj(ORDINARY_ITEM);

    engine = builder.build();
    engine.send(Input.start());

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
    engine.send(Input.start());
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
    engine.send(Input.start());
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});

    expectWords([], ["go", "look", "get", "wait"]);

    executeAndTest(["get", "key"], {});
    executeAndTest(["look"], { expected : ["An almost empty room"], notExpected : ["key"]});

    expectWords([], ["go", "look", "drop", "wait"]);
   
    executeAndTest(["drop", "key"], {});
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});
});

test("Test examine", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "teapot",
        type : "item",
        location : "theRoom",
        desc : "A little teapot, {{dimensions}}",
        dimensions : "short and stout"
    })
    engine = builder.build();
    engine.send(Input.start());
    expectWords([], ["go", "look", "examine", "wait"]);
    executeAndTest(["examine", "teapot"], { expected : ["A little teapot, short and stout"]});
});

test("Test simple rules", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "rule1",
        type : "rule",
        run : ["print('hello world')"]
    })
    engine = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["Time passes", "hello world"]});
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
    engine.send(Input.start());
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
    engine.send(Input.start());
     
    executeAndTest(["look"], { expected : ["an ordinary item", "another item", "another another item"]});

    executeAndTest(["get", "anItem"], { expected : ["No getting the ordinary item"]});
    executeAndTest(["look"], { expected : ["an ordinary item", "another item", "another another item"]});

    executeAndTest(["get", "otherItem"], { expected : ["This inscope item can also stop other items being picked up"]});
    executeAndTest(["look"], { expected : ["an ordinary item", "another item", "another another item"]});

    executeAndTest(["get", "otherItem2"], { expected : ["Finally something gettable"]});
    executeAndTest(["look"], { expected : ["an ordinary item", "another item"]});
});

test("Test open door", () => {
    builder.withObj({
                ...THE_ROOM,
                exits : { north : "northRoom" }})
           .withObj({
                ...NORTH_ROOM,
                tags: []})
           .withObj(SOUTH_ROOM)
           .withObj({
                id : "door",
                name : "the door",
                type : "item",
                desc : "The door is {{#isOpen}}open{{/isOpen}}{{^isOpen}}closed{{/isOpen}}",
                location : "theRoom",
                isOpen : false,
                verbs : ["open", "close"],
                tags : ["openable"],
                before : [
                    "open(this) => openExit('theRoom', 'south', 'southRoom')",
                    "close(this) => closeExit('theRoom', 'south')"],
                after : [
                    "open(this) => 'The door slowly opens'",
                    "close(this) => 'The door slams shut'"]
           })
           .withObj({
                id : "open",
                type : "verb",
                tags : ["transitive"],
                actions : [
                    "open($openable) => do(openable.isOpen = true, 'Opened!')"
                ]
           })
           .withObj({
                id : "close",
                type : "verb",
                tags : ["transitive"],
                actions : [
                    "close($openable) => do(openable.isOpen = false, 'Closed!')"
                ]
           })
    engine = builder.build();
    engine.send(Input.start());

    // Initial state
    executeAndTest(["examine", "door"], { expected : ["The door is closed"]});
    expectWords(["go"], ["north"]);

    // Try opening the door
    executeAndTest(["open", "door"], { expected : ["The door slowly opens"]});
    executeAndTest(["examine", "door"], { expected : ["The door is open"]});
    expectWords(["go"], ["north", "south"]);

    // Try closing the door
    executeAndTest(["close", "door"], { expected : ["The door slams shut"]});
    expectWords(["go"], ["north"]);
    executeAndTest(["examine", "door"], { expected : ["The door is closed"]});
});

test("Test setting 'this' in match action", () => {
    builder.withObj(THE_ROOM)
           .withObj({
                id : "thing",
                name : "thing",
                type : "item",
                location : "theRoom",
                fuddled : false,
                desc : "The thing is {{#fuddled}}completely fuddled{{/fuddled}}{{^fuddled}}perfectly ok{{/fuddled}}",
                verbs : ["fuddle"],
                before : [
                   "fuddle(this) => do(this.fuddled = true, 'Fuddled!')"
                ]
           })
           .withObj({
                id : "fuddle",
                type : "verb",
                tags : ["transitive"]
           });

    engine = builder.build();
    engine.send(Input.start());

    // Initial state
    executeAndTest(["examine", "thing"], { expected : ["The thing is perfectly ok"]});

    // Try fuddling
    executeAndTest(["fuddle", "thing"], { expected : ["Fuddled!"]});
    executeAndTest(["examine", "thing"], { expected : ["The thing is completely fuddled"]});
});

test("Test error when executing", () => {
    builder.withObj(THE_ROOM)
           .withObj({
                id : "thing",
                name : "thing",
                type : "item",
                location : "theRoom",
                fuddled : false,
                desc : "The thing is {{#fuddled}}completely fuddled{{/fuddled}}{{^fuddled}}perfectly ok{{/fuddled}}",
                verbs : ["fuddle"],
                before : [
                   "fuddle(this) => do(this.fuddled.bob = foo, 'Fuddled!')"
                ]
           })
           .withObj({
                id : "fuddle",
                type : "verb",
                tags : ["transitive"]
           });

    engine = builder.build();
    engine.send(Input.start());

    executeAndTest(["fuddle", "thing"], { expected : ["thing.before[0]", "Execution failed"]});
});

test("Test load save data", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        desc : "The room is dark and square",
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        desc : "The room is light and round",
        exits : {
            north : "northRoom"
        }
    })
    engine = builder.build();
    engine.send(Input.config({"autoLook" : true }));
    engine.send(Input.start());

    expect(messages.join()).toContain("The room is dark and square");
    messages.length = 0;

    executeAndTest(["go", "south"], { expected : [ "The room is light and round" ] })
    const saveStr = JSON.stringify(saveData.data);

    engine = builder.build();
    engine.send(Input.config({"autoLook" : true }));
    engine.send(Input.start(saveStr));

    const allMessages = messages.join();
    expect(allMessages).toContain("The South Room");
    expect(allMessages).not.toContain("The North Room");
    expect(allMessages).not.toContain("the room is light and round");
    expect(allMessages).not.toContain("The room is dark and square");
});

test("Test load save after getting item", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "key",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });
    // Start a game
    engine = builder.build();
    engine.send(Input.start());
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});

    // Get the key
    executeAndTest(["get", "key"], {});
    const saveStr = JSON.stringify(saveData.data);

    // Start a new game, using the save data
    engine = builder.build();
    engine.send(Input.start(saveStr));
    executeAndTest(["look"], { expected : ["An almost empty room"], notExpected :["key"]});

    expect(saveData.data).toEqual(
        [{"type":"Set", "property":["entities", "key", "location"], "newValue":"INVENTORY"}])

});

interface ExpectedStrings {
    expected? : string[],
    notExpected? : string[]
}

function executeAndTest(command : string[], expectedMessages : ExpectedStrings) {
    engine.send(Input.execute(command));
    const joined = messages.join("\n");
    expectedMessages.expected?.forEach(str => {
        expect(joined).toContain(str);
    })
    expectedMessages.notExpected?.forEach(str => {
        expect(joined).not.toContain(str);
    })
    messages.length = 0;
} 

function expectWords(command : string[], expectedNextWords : string[]) {
    const words = getWordIds(engine, (command));
    expect(words).toHaveLength(expectedNextWords.length);
    expect(words).toEqual(expect.arrayContaining(expectedNextWords));
}

function getWordIds(engine : Engine, partial : string[]) : string[] {
    engine.send(Input.getNextWords(partial));
    const words = [...wordsResponse];
    wordsResponse.length = 0;
    return words;
}