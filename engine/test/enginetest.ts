import { BasicEngine } from "../src/engine";
import { EngineBuilder } from "../src/game/enginebuilder";
import { listOutputConsumer, SaveData, loadDefaults, ExecuteAndTestFn, GetWordIdsFn, ExpectWordsFn, createEngineTestEnvironment, EngineRef, ExpectStatusFn } from "./testutils/testutils";
import { Input } from "../src/main";
import { THE_ROOM, ORDINARY_ITEM, OTHER_ITEM, YET_ANOTHER_ITEM, NORTH_ROOM, SOUTH_ROOM, GOBLIN, GAME_METADATA } from "./testutils/testobjects";
import { STANDARD_VERBS } from "./testutils/testutils";
import { Log, StatusType } from "tift-types/src/messages/output";
import { Obj } from "../src/util/objects";

let messages : string[];
let wordsResponse : string[];
let statuses : StatusType[]
let saveData : SaveData;
let log : Log[];
let info : Obj;
let builder : EngineBuilder;
let engine : EngineRef;
let executeAndTest : ExecuteAndTestFn;
let getWordIds : GetWordIdsFn;
let expectWords : ExpectWordsFn;
let expectStatus : ExpectStatusFn;

beforeEach(() => {
    const testEnvironment = createEngineTestEnvironment();
    messages = testEnvironment.messages;
    engine = testEnvironment.engine;
    builder = testEnvironment.builder;
    saveData = testEnvironment.saveData;
    wordsResponse = testEnvironment.wordsResponse;
    statuses = testEnvironment.statuses;
    log = testEnvironment.log;
    info = testEnvironment.info;
    executeAndTest = testEnvironment.executeAndTest;
    getWordIds = testEnvironment.getWordsIds;
    expectWords = testEnvironment.expectWords;
    expectStatus = testEnvironment.expectStatus;
});

test("Test single room, no exits", () => {
    builder.withObj(NORTH_ROOM)
    engine.ref = builder.build();
    engine.send(Input.start());

    expectWords([], [...STANDARD_VERBS]);
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
    engine.ref = builder.build();
    engine.send(Input.start());

    expectWords([], [...STANDARD_VERBS]);
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
    engine.ref = builder.build();
    engine.send(Input.start());

    expectWords([], [...STANDARD_VERBS]);
    expectWords(["go"],["south", "east"]);
    expectWords(["go", "south"], []);
    expectWords(["go", "east"], []);
    expectWords(["eat"], []);
    expect(messages).toHaveLength(0);
})

test("Test two rooms", () => {
    builder.withObj({
        ...NORTH_ROOM,
        description : "The room is dark and square",
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
    engine.ref = builder.build();
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
        description : "The room is dark and square",
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        description : "The room is light and round",
        exits : {
            north : "northRoom"
        }
    })
    engine.ref = builder.build();
    engine.send(Input.config({"autoLook" : true }));
    engine.send(Input.start());

    expect(messages.join()).toContain("The room is dark and square");
    messages.length = 0;

    executeAndTest(["go", "south"], { expected : [ "The room is light and round" ] })
    executeAndTest(["go", "north"], { expected : [ "**The North Room**" ], notExpected : ["The room is dark and square"] })
    executeAndTest(["go", "south"], { expected : [ "**The South Room**" ], notExpected : ["The room is light and round"] })
})

test("Test auto look happens after beforeGame function", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        description : "The room is dark and square",
        "beforeGame()" : "print('This should come first')"
    });
    engine.ref = builder.build();
    engine.send(Input.config({"autoLook" : true }));
    engine.send(Input.start());

    const beforeGameIndex = messages.findIndex(message => message.includes("This should come first"));
    const lookIndex = messages.findIndex(message => message.includes("The room is dark and square"));
    expect(beforeGameIndex).toBeGreaterThanOrEqual(0);
    expect(lookIndex).toBeGreaterThanOrEqual(0);

    expect(beforeGameIndex).toBeLessThan(lookIndex);
});

test("Test auto look with description change", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        description : "The room is dark and square",
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        description : "The room is light and round",
        exits : {
            north : "northRoom"
        }
    })
    builder.withObj({
        id : "switch", 
        type : "item",
        location : "southRoom",
        verbs : ["toggle"],
        before : { 
            "toggle(this)" : "northRoom.description = 'The room is light and square'"
        }
    })
    builder.withObj({
        id : "toggle", 
        type : "verb",
        tags : ["transitive"]
    })
    engine.ref = builder.build();
    engine.send(Input.config({"autoLook" : true }));
    engine.send(Input.start());

    expect(messages.join()).toContain("The room is dark and square");
    messages.length = 0;

    executeAndTest(["go", "south"], { expected : [ "The room is light and round" ] });
    executeAndTest(["toggle", "switch"], {});
    executeAndTest(["go", "north"], { expected : [ "The room is light and square" ], notExpected : ["The room is dark and square"] });
    executeAndTest(["go", "south"], { expected : [ "**The South Room**" ], notExpected : ["The room is light and round"] })
    executeAndTest(["go", "north"], { expected : [ "**The North Room**" ], notExpected : ["The room is light and square"] })
})
//builder.withObj(THE_ROOM)
//.withObj({
//     id : "thing",
//     name : "thing",
//     type : "item",
//     location : "theRoom",
//     fuddled : false,
//     description : "The thing is {{#fuddled}}completely fuddled{{/fuddled}}{{^fuddled}}perfectly ok{{/fuddled}}",
//     verbs : ["fuddle"],
//     before : [
//        "fuddle(this) => do(this.fuddled = true, 'Fuddled!')"
//     ]
//})
//.withObj({
//     id : "fuddle",
//     type : "verb",
//     tags : ["transitive"]
//});

test("Test room with item", () => {
    builder.withObj(THE_ROOM);
    builder.withObj(ORDINARY_ITEM);
    engine.ref = builder.build();
    engine.send(Input.start());
    
    engine.send(Input.execute(["look"]));
    executeAndTest(["look"], { expected : ["An almost empty room", "an ordinary item"]});

    expectWords([], [...STANDARD_VERBS, "get"]);
})

test("Test get item", () => {
    builder.withObj(THE_ROOM);
    builder.withObj(ORDINARY_ITEM);

    engine.ref = builder.build();
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
    engine.ref = builder.build();
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
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});

    expectWords([], [...STANDARD_VERBS, "get"]);

    executeAndTest(["get", "key"], {});
    executeAndTest(["look"], { expected : ["An almost empty room"], notExpected : ["key"]});

    expectWords([], [...STANDARD_VERBS, "drop"]);
   
    executeAndTest(["drop", "key"], {});
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});
});

test("Test examine", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "teapot",
        type : "item",
        location : "theRoom",
        description : "A little teapot, {{dimensions}}",
        dimensions : "short and stout"
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    expectWords([], [...STANDARD_VERBS, "examine"]);
    executeAndTest(["examine", "teapot"], { expected : ["A little teapot, short and stout"]});
});

test("Test simple rules", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "rule1",
        type : "rule",
        "afterTurn()" : ["print('hello world')"]
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["Time passes", "hello world"]});
});

test("Test simple before/after rules", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "rule1",
        type : "rule",
        "beforeGame()" : "print('hello game')",
        "beforeTurn()" : "print('hello world')",
        "afterTurn()" : "print('goodbye world')"
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    engine.send(Input.execute(["wait"]));
    expect(messages).toEqual(["hello game", "hello world", "Time passes", "goodbye world"]);
    messages.length = 0;
    engine.send(Input.execute(["wait"]));
    expect(messages).toEqual(["hello world", "Time passes", "goodbye world"]);
    messages.length = 0;
});

test("Test simple global/contextal before/after rules", () => {
    builder.withObj({
        ...THE_ROOM,
        "beforeGame()" : "print('before game')",
        "beforeTurn()" : "print('room before')",
        "afterTurn()" : "print('room after')"
    });
    builder.withObj({
        id : "rule1",
        type : "rule",
        "beforeGame()" : "print('before game')",
        "beforeTurn()" : "print('rule before')",
        "afterTurn()" : "print('rule after')"
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    engine.send(Input.execute(["wait"]));
    expect(messages).toEqual(['before game', 'before game','rule before', 'room before', 'Time passes', 'room after', 'rule after']);
    messages.length = 0;
    engine.send(Input.execute(["wait"]));
    expect(messages).toEqual(['rule before', 'room before', 'Time passes', 'room after', 'rule after']);
    messages.length = 0;
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

    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["look"], { expected : ["hot rock", "cool rock"]});
    executeAndTest(["get", "hotRock"], { expected : ["Ouch!"], notExpected : ["Bingo!"]});
    executeAndTest(["look"], { expected : ["hot rock", "cool rock"]});
    executeAndTest(["get", "coolRock"], { expected : ["Bingo!"], notExpected : ["Ouch!"]});
    executeAndTest(["look"], { expected : ["hot rock"], notExpected : ["cool rock"]});
});

test("Test before and after actions specified as object properties", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "hotRock",
        name : "hot rock",
        type : "item",
        location : "theRoom",
        before : { "get(this)" : "'Ouch!'" },
        after : { "get(this)" : "'Bingo!'"},
        tags : ["carryable"]
    });
    builder.withObj({
        id : "coolRock",
        name : "cool rock",
        type : "item",
        location : "theRoom",
        after : { "get(this)" : "'Bingo!'" },
        tags : ["carryable"]
    });

    engine.ref = builder.build();
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
            "get($item) => if(item.id == 'otherItem2').then(false).else('No using wildcard gets here')",
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
    engine.ref = builder.build();
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
                description : "The door is {{#isOpen}}open{{/isOpen}}{{^isOpen}}closed{{/isOpen}}",
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
    engine.ref = builder.build();
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

test('Test ask verb', () => {
    builder.withObj({...THE_ROOM})
           .withObj({
            id : "barkeep",
            type : "item",
            name : "the barkeep",
            location : "theRoom",
            verbs : ["ask"]
           })
           .withObj({
            id : "ask",
            type : "verb",
            tags : ["transitive"],
            attributes : ["about"]
           })
           .withObj({
            id : "beerThought",
            type : "item",
            location : "theRoom",
            verbs : ["ask.about"],
            before : ["ask(barkeep).about(this) => 'I recomend the porter'"]
           });
    engine.ref = builder.build();
    engine.send(Input.start());
    expectWords([], [...STANDARD_VERBS, "ask"]);
    expectWords(["ask"], ["barkeep"]);
    expectWords(["ask", "barkeep"], ["about"]);
    expectWords(["ask", "barkeep", "about"], ["beerThought"]);
    executeAndTest(["ask", "barkeep", "about", "beerThought"], {expected : ["I recomend the porter"]});
});

test("Test setting 'this' in match action", () => {
    builder.withObj(THE_ROOM)
           .withObj({
                id : "thing",
                name : "thing",
                type : "item",
                location : "theRoom",
                fuddled : false,
                description : "The thing is {{#fuddled}}completely fuddled{{/fuddled}}{{^fuddled}}perfectly ok{{/fuddled}}",
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

    engine.ref = builder.build();
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
                description : "The thing is {{#fuddled}}completely fuddled{{/fuddled}}{{^fuddled}}perfectly ok{{/fuddled}}",
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

    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["fuddle", "thing"], { errors : ["thing.before[0]", "Execution failed"]});
});

test("Test load save data", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        description : "The room is dark and square",
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        description : "The room is light and round",
        exits : {
            north : "northRoom"
        }
    })

    const config = {
        "autoLook" : true,
        undoLevels : 0 
    };

    builder.withConfig(config);

    engine.ref = builder.build();
    
    engine.send(Input.start());

    expect(messages.join()).toContain("The room is dark and square");
    messages.length = 0;

    executeAndTest(["go", "south"], { expected : [ "The room is light and round" ] })
    const saveStr = JSON.stringify(saveData.data);

    engine.ref = builder.build();
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
    builder.withConfig({ undoLevels : 0 });


    // Start a game
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});

    // Get the key
    executeAndTest(["get", "key"], {});
    const saveStr = JSON.stringify(saveData.data);

    // Start a new game, using the save data
    engine.ref = builder.build();
    engine.send(Input.start(saveStr));
    executeAndTest(["look"], { expected : ["An almost empty room"], notExpected :["key"]});

    expect(saveData.data.baseHistory).toEqual(
        [{"type":"Set", "property":["entities", "key", "location"], "newValue":"__INVENTORY__"}])
});

test("Test reset", () => {
    // Need to recreate the builder later, so store constructions as a lambda
    const getBuilder = () => {
        const builder = new EngineBuilder().withOutput(listOutputConsumer(messages, wordsResponse, saveData, statuses, log, info));
        builder.withObj(GAME_METADATA);
        builder.withObj(THE_ROOM);
        builder.withObj({
            id : "key",
            type : "item",
            location : "theRoom",
            tags : ["carryable"]
        });
        builder.withConfigEntry("undoLevels", 0);
        loadDefaults(builder);
        return builder;
    }
    // Start a game
    engine.ref = getBuilder().build();
    engine.send(Input.start());
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});

    // Get the key
    executeAndTest(["get", "key"], {});
    executeAndTest(["look"], { expected : ["An almost empty room"], notExpected : ["key"]});

    // Reset the engine
    engine.send(Input.reset());
    getBuilder().addTo(engine.ref as BasicEngine);
    engine.send(Input.start());

    // The key should be back in place
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});
})

test("Test command deduplication", () => {
    engine.ref = builder.withObj(THE_ROOM)
                    .withObj(ORDINARY_ITEM)
                    .withObj(OTHER_ITEM)
                    .build();

    engine.send(Input.start());
    expectWords([], [...STANDARD_VERBS, "get"]);
})

test("Test contextual rules", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        description : "The room is dark and square",
        myvar : "foo",
        "afterTurn()" : ["print(this.myvar)"],
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        description : "The room is light and round",
        myvar : "bar",
        "afterTurn()" : ["this.myvar"],
        exits : {
            north : "northRoom"
        }
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["foo"], notExpected : ["bar"]});
    executeAndTest(["go", "south"], { expected : ["bar"], notExpected : ["foo"]})
    executeAndTest(["wait"], { expected : ["bar"], notExpected : ["foo"]})
    executeAndTest(["go", "north"], { expected : ["foo"], notExpected : ["bar"]})
});

test("Test repeat rule", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        description : "The room is dark and square",
        myvar : "foo",
        "afterTurn()" : { "repeat" : ["'foo'", "'bar'", "'baz'"] } 
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["foo"], notExpected : ["bar", "baz"]})
    executeAndTest(["wait"], { expected : ["bar"], notExpected : ["foo", "baz"]})
    executeAndTest(["wait"], { expected : ["baz"], notExpected : ["foo", "bar"]})
    executeAndTest(["wait"], { expected : ["foo"], notExpected : ["bar", "baz"]})
});

test("Test nested repeat rule", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        description : "The room is dark and square",
        myvar : "foo",
        "afterTurn()" : { "repeat" : ["'foo'", { "repeat" : ["'bar'", "'baz'"] } , "'qux'"] } 
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["foo"], notExpected : ["bar", "baz", "qux"]})
    executeAndTest(["wait"], { expected : ["bar"], notExpected : ["foo", "baz", "qux"]})
    executeAndTest(["wait"], { expected : ["qux"], notExpected : ["foo", "bar", "baz"]})
    executeAndTest(["wait"], { expected : ["foo"], notExpected : ["bar", "baz", "qux"]})
    executeAndTest(["wait"], { expected : ["baz"], notExpected : ["foo", "bar", "qux"]})
    executeAndTest(["wait"], { expected : ["qux"], notExpected : ["foo", "bar", "baz"]})
    executeAndTest(["wait"], { expected : ["foo"], notExpected : ["bar", "baz", "qux"]})
})

test("Test moveTo", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        description : "The room is dark and square",
        myvar : "foo",
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        description : "The room is light and round",
        myvar : "bar",
        exits : {
            north : "northRoom"
        }
    })
    builder.withObj({
        ...GOBLIN,
        location : "northRoom"
    });
    builder.withObj({
        id: "moveGoblin",
        type: "rule",
        "afterTurn()": {
            "repeat": ["do(print('The goblin goes south'), move('goblin').to('southRoom'))",
                        "do(print('The goblin goes north'), move('goblin').to('northRoom'))"]
        }
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["look"], { expected : ["Goblin"]});
    executeAndTest(["wait"], { expected : ["The goblin goes south"]});
    executeAndTest(["look"], { notExpected : ["Goblin"]});
    executeAndTest(["wait"], { expected : ["The goblin goes north"]});
    executeAndTest(["look"], { expected : ["Goblin"]});
    executeAndTest(["wait"], { expected : ["The goblin goes south"]});
    executeAndTest(["look"], { notExpected : ["Goblin"]});
    executeAndTest(["wait"], { expected : ["The goblin goes north"]});
    executeAndTest(["look"], { expected : ["Goblin"]});
});

test("Test printAt", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        description : "The room is dark and square",
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        description : "The room is light and round",
        exits : {
            north : "northRoom"
        }
    })
    builder.withObj({
        ...GOBLIN,
        location : "northRoom"
    });
    builder.withObj({
        id: "moveGoblin",
        type: "rule",
        "afterTurn()": {
            "repeat": [
                ["printAt(goblin.location, 'The goblin goes south')",
                 "move(goblin).to(southRoom)"],
                ["printAt(goblin.location, 'The goblin goes north')",
                 "move(goblin).to(northRoom)"]
            ]
        }
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["The goblin goes south"]});
    executeAndTest(["wait"], { notExpected : ["The goblin goes north"]});
    executeAndTest(["wait"], { expected : ["The goblin goes south"]});
    executeAndTest(["wait"], { notExpected : ["The goblin goes north"]});
});

test("Test scoped rules", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        description : "The room is dark and square",
        myvar : "foo",
        exits : {
            south : "southRoom"
        },
    });
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        description : "The room is light and round",
        myvar : "bar",
        exits : {
            north : "northRoom"
        }
    });
    builder.withObj({
        id:"scopedGhost",
        type:"rule",
        scope: ["southRoom"],
        "afterTurn()": "'wooo-oo'"
    })
    builder.withObj({
        id:"globalMonster",
        type:"rule",
        "afterTurn()": "'grr'"
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["grr"], notExpected : ["wooo-oo"]});
    executeAndTest(["go", "south"], { expected : ["grr", "wooo-oo"]});
    executeAndTest(["wait"], { expected : ["grr", "wooo-oo"]});
    executeAndTest(["go", "north"], { expected : ["grr"], notExpected : ["wooo-oo"]});
})

test("Test action with repeat", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
               id : "rubbish",
               description : "A pile of stinking rubbish",
               type : "item",
               location : "northRoom",
               after : {
                   "examine(this)" : {
                       repeat : ["'You see some mouldy bread'", "'You see an old tin can'", "'You see a banana peel'"]
                   }
               }
           })
          .withConfigEntry("undoLevels", 0);
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["examine", "rubbish"], { expected : ["mouldy bread"], notExpected : ["tin can", "banana peel"]});
    executeAndTest(["wait"], {});

    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":1}]);

    executeAndTest(["examine", "rubbish"], { expected : ["tin can"], notExpected : ["mouldy bread", "banana peel"]});
    executeAndTest(["wait"], {});
    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":2}]);

    executeAndTest(["examine", "rubbish"], { expected : ["banana peel"], notExpected : ["tin can", "moudly bread"]});
    executeAndTest(["wait"], {});
    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":0}]);

    executeAndTest(["examine", "rubbish"], { expected : ["mouldy bread"], notExpected : ["tin can", "banana peel"]});
    executeAndTest(["wait"], {});
    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":1}]);

    executeAndTest(["examine", "rubbish"], { expected : ["tin can"], notExpected : ["mouldy bread", "banana peel"]});
    executeAndTest(["wait"], {});
    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":2}]);

    executeAndTest(["examine", "rubbish"], { expected : ["banana peel"], notExpected : ["tin can", "moudly bread"]});
    executeAndTest(["wait"], {});
    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":0}]);

});

test("Test action with nested repeats", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
               id : "rubbish",
               description : "A pile of stinking rubbish",
               type : "item",
               location : "northRoom",
               after : {
                   "examine(this)" : {
                       repeat : ["'foo'", { repeat : ["'bar'", "'baz'"] } ]
                   }
               }
           })
          .withConfigEntry("undoLevels", 0);
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["examine", "rubbish"], { expected : ["foo"], notExpected : ["bar", "baz"]});
    executeAndTest(["wait"], {});
    expect(saveData.data.baseHistory).toStrictEqual([
        {"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":1}]
    );

    executeAndTest(["examine", "rubbish"], { expected : ["bar"], notExpected : ["foo", "baz"]});
    executeAndTest(["wait"], {});
    expect(saveData.data.baseHistory).toStrictEqual([
        {"type":"Set","property":["entities","rubbish","after","0","repeat","1","repeat","index"],"newValue":1},
        {"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":0}]
    );

    executeAndTest(["examine", "rubbish"], { expected : ["foo"], notExpected : ["bar", "baz"]});
    executeAndTest(["examine", "rubbish"], { expected : ["baz"], notExpected : ["bar", "foo"]});
    executeAndTest(["examine", "rubbish"], { expected : ["foo"], notExpected : ["bar", "baz"]});
    executeAndTest(["examine", "rubbish"], { expected : ["bar"], notExpected : ["foo", "baz"]});
    executeAndTest(["examine", "rubbish"], { expected : ["foo"], notExpected : ["bar", "baz"]});
    executeAndTest(["examine", "rubbish"], { expected : ["baz"], notExpected : ["bar", "foo"]});
});

test("Test property setting in before phase", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "armchair",
                description : "A threadbare armchair.  {{#sat_on}}sitting{{/sat_on}} {{^sat_on}}standing{{/sat_on}}",
                type : "item",
                location : "northRoom",
                verbs : ["sit"],
                sat_on : false,
                before : {
                    "sit(this)" : {
                        "when" : "!this.sat_on",
                        "do" : ["print('You sit down')", "this.sat_on=true"],
                        "otherwise" : "'You are already sitting'"
                    } 
                }
           })
           .withObj({
                id : "sit",
                type : "verb",
                tags : ["transitive"]
           });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "standing"], notExpected : ["sitting"]});
    executeAndTest(["sit", "armchair"], { expected : ["You sit down"] });
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "sitting"], notExpected : ["standing"]});
    executeAndTest(["sit", "armchair"], { expected : ["You are already sitting"] });
})

test("Test conditional verbs", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "armchair",
                description : "A threadbare armchair.  {{#sat_on}}sitting{{/sat_on}} {{^sat_on}}standing{{/sat_on}}",
                type : "item",
                location : "northRoom",
                verbs : [{ "sit" : "not(sat_on)"}, { "stand" : "sat_on"}],
                sat_on : false,
                before : {
                    "sit(this)" : {
                        "when" : "not(sat_on)",
                        "do" : ["print('You sit down')", "sat_on=true"],
                        "otherwise" : "'You are already sitting'"
                    },
                    "stand" : {
                        "when" : "sat_on",
                        "do" : ["print('You stand up')", "sat_on=false"],
                        "otherwise" : "'You are already standing'"
                    }
                }
           })
           .withObj({
                id : "sit",
                type : "verb",
                tags : ["transitive"]
           })
           .withObj({
                id : "stand",
                type : "verb",
                tags : ["intransitive"]
           });
    engine.ref = builder.build();
    engine.send(Input.start());

    let words = getWordIds([]);
    expect(words.includes("sit")).toBeTruthy();
    expect(words.includes("stand")).toBeFalsy();

    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "standing"], notExpected : ["sitting"]});
    executeAndTest(["sit", "armchair"], { expected : ["You sit down"] });
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "sitting"], notExpected : ["standing"]});

    words = getWordIds([]);
    expect(words.includes("sit")).toBeFalsy();
    expect(words.includes("stand")).toBeTruthy();

    // Test undo resets things correctly
    engine.send(Input.undo());
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "standing"], notExpected : ["sitting"]});
    words = getWordIds([]);
    expect(words.includes("sit")).toBeTruthy();
    expect(words.includes("stand")).toBeFalsy();

    engine.send(Input.redo());
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "sitting"], notExpected : ["standing"]});
    words = getWordIds([]);
    expect(words.includes("sit")).toBeFalsy();
    expect(words.includes("stand")).toBeTruthy();

    executeAndTest(["stand"], { expected : ["You stand up"] });
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "standing"], notExpected : ["sitting"]});

});

test("Test multiple exits with one conditional exit", () => {
    builder.withObj({
                ...THE_ROOM,
                description : "There is a rock blocking the south exit",
                southOpen : false,
                exits : {
                    south : {"southRoom" : "this.southOpen"},
                    north : "northRoom"
                },
                "afterTurn()" : "print('southOpen: ' + this.southOpen)"
            })
            .withObj({
                ...NORTH_ROOM,
                description : "The north room",
                exits : { "south" : "theRoom" },
                tags: []
            })
            .withObj({
                ...SOUTH_ROOM,
                "description" : "The room is light and round",
                exits : { north : "northRoom" }
            })
            .withObj({
                id : "rock",
                description : "A large rock",
                type : "item",
                location : "theRoom",
                tags : ["carryable"],
                after : {
                    "get(this)" : [
                        "print('You pick up the rock')", 
                        //"set('theRoom.southOpen', true)", // TODO why doesn't this work?
                        "theRoom.southOpen = true",
                        "theRoom.description = 'The room is now open to the south'"
                    ]
                }
            });

    engine.ref = builder.build();
    engine.send(Input.start());

    // Should not be able to go south initially
    executeAndTest(["look"], { expected : ["There is a rock blocking the south exit", "rock"]});
    expectWords([], ["go", "get"], false);
    expectWords(["go"], ["north"], true, ["south"]);
    executeAndTest(["get", "rock"], { expected : ["You pick up the rock"]});
    executeAndTest(["look"], { expected : ["The room is now open to the south"]});
    
    // South should now be open
    expectWords([], ["go"], false);
    expectWords(["go"], ["north", "south"]);
    executeAndTest(["go", "south"], {});
    executeAndTest(["look"], { expected : ["The room is light and round"]});
});

test("Test single conditional exit", () => {
    builder.withObj({
                ...THE_ROOM,
                southOpen : false,
                exits : {
                    south : {"southRoom" : "southOpen"},
                }
            })
            .withObj({
                ...SOUTH_ROOM,
                "description" : "The room is light and round",
                exits : { north : "northRoom" }
            })
            .withObj({
                id : "rock",
                description : "A large rock",
                type : "item",
                location : "theRoom",
                tags : ["carryable"],
                after : {
                    "get(this)" : [
                        "print('You pick up the rock')", 
                        "theRoom.southOpen = true",
                    ]
                }
            });

    engine.ref = builder.build();
    engine.send(Input.start());

    // Should not be able to go south initially
    expectWords([], ["get"], false, ["go"]);
    executeAndTest(["get", "rock"], { expected : ["You pick up the rock"]});
    
    // South should now be open
    expectWords([], ["go"], false);
    expectWords(["go"], ["south"]);
    executeAndTest(["go", "south"], {});
    executeAndTest(["look"], { expected : ["The room is light and round"]});
});

test("Test put item in container", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "box",
                description : "A large wooden box",
                location : "northRoom",
                type : "item",
                verbs : ["put.in"]
           })
           .withObj({
                id : "ball",
                description : "A small ball",
                location : "northRoom",
                type : "item",
                tags : ["carryable"]
           });
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in the box"] });
    executeAndTest(["get", "ball"], {});
    executeAndTest(["look"], { notExpected : ["ball", "in the box"] });
    executeAndTest(["put", "ball", "in", "box"], {});
    executeAndTest(["look"], { expected : ["ball", "in the box"] });
})

test("Test adposition", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "shelf",
                description : "A large wooden shelf",
                location : "northRoom",
                adposition : "on",
                type : "item",
                verbs : ["put.on"]
           })
           .withObj({
                id : "ball",
                description : "A small ball",
                location : "northRoom",
                type : "item",
                tags : ["carryable"]
           });
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["ball"], notExpected : ["on the shelf"] });
    executeAndTest(["get", "ball"], {});
    executeAndTest(["look"], { notExpected : ["ball", "on the shelf"] });
    executeAndTest(["put", "ball", "on", "shelf"], {});
    executeAndTest(["look"], { expected : ["ball", "on the shelf"] });

})

test("Test openable", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "door",
                location : "northRoom",
                description : "An old wooden door",
                type : "item",
                tags : ["openable"],
                before : {
                    "examine(this)" : {
                        when : "this.is_open",
                        do : "print('The door is open')",
                        otherwise : "print('The door is closed')"
                    }
                }
           })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["examine", "door"], { expected : ["closed"], notExpected : ["open"]});
    let words = getWordIds([]);
    expect(words).toContain("open");
    expect(words).not.toContain("close");

    executeAndTest(["open", "door"], { expected : ["open"] });
    executeAndTest(["examine", "door"], { expected : ["open"], notExpected : ["closed"]});
    words = getWordIds([]);
    expect(words).toContain("close");
    expect(words).not.toContain("open");

    executeAndTest(["close", "door"], { expected : ["close"] });
    executeAndTest(["examine", "door"], { expected : ["closed"], notExpected : ["open"]});
    words = getWordIds([]);
    expect(words).toContain("open");
    expect(words).not.toContain("close");
});

test("Test closable", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "door",
                location : "northRoom",
                description : "An old wooden door",
                type : "item",
                tags : ["closable"],
                before : {
                    "examine(this)" : {
                        when : "this.is_open",
                        do : "print('The door is open')",
                        otherwise : "print('The door is closed')"
                    }
                }
           })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["examine", "door"], { expected : ["open"], notExpected : ["closed"]});
    let words = getWordIds([]);
    expect(words).toContain("close");
    expect(words).not.toContain("open");

    executeAndTest(["close", "door"], { expected : ["close"]});
    executeAndTest(["examine", "door"], { expected : ["closed"], notExpected : ["open"]});
    words = getWordIds([]);
    expect(words).toContain("open");
    expect(words).not.toContain("close");

    executeAndTest(["open", "door"], { expected : ["open"]});
    executeAndTest(["examine", "door"], { expected : ["open"], notExpected : ["closed"]});
    words = getWordIds([]);
    expect(words).toContain("close");
    expect(words).not.toContain("open");
});

test("Test undo", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "box",
                description : "A large wooden box",
                location : "northRoom",
                type : "item",
                verbs : ["put.in"]
           })
           .withObj({
                id : "ball",
                description : "A small ball",
                location : "northRoom",
                type : "item",
                tags : ["carryable"]
           });
    engine.ref = builder.build();
    engine.send(Input.start());
    expectStatus({undoable : false, redoable : false});

    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in the box"] });
    expectStatus({undoable : false, redoable : false});

    executeAndTest(["get", "ball"], {});
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["look"], { notExpected : ["ball", "in the box"] });
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["put", "ball", "in", "box"], {});
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["look"], { expected : ["ball", "in the box"] });
    expectStatus({undoable : true, redoable : false});

    // Try undoing
    engine.send(Input.undo());
    executeAndTest(["look"], { notExpected : ["ball", "in the box"] });
    expectStatus({undoable : true, redoable : true});

    engine.send(Input.undo());
    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in the box"] });
    expectStatus({undoable : false, redoable : true});

    // Try redoing
    engine.send(Input.redo());
    executeAndTest(["look"], { notExpected : ["ball", "in the box"] });
    expectStatus({undoable : true, redoable : true});

    engine.send(Input.redo());
    executeAndTest(["look"], { expected : ["ball", "in the box"] });
    expectStatus({undoable : true, redoable : false});
})

test("Test undo, clear redo on new action", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "box",
                description : "A large wooden box",
                location : "northRoom",
                type : "item",
                verbs : ["put.in"]
           })
           .withObj({
                id : "ball",
                description : "A small ball",
                location : "northRoom",
                type : "item",
                tags : ["carryable"]
           });
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in the box"] });
    executeAndTest(["get", "ball"], {});
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["look"], { notExpected : ["ball", "in the box"] });
    executeAndTest(["put", "ball", "in", "box"], {});
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["look"], { expected : ["ball", "in the box"] });

    // Try undoing
    engine.send(Input.undo());
    executeAndTest(["look"], { notExpected : ["ball", "in the box"] });
    expectStatus({undoable : true, redoable : true});
    executeAndTest(["drop", "ball"], {});
    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in the box"] });
    expectStatus({undoable : true, redoable : false});

    // Try redoing, nothing should change
    engine.send(Input.redo());
    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in the box"] });
    expectStatus({undoable : true, redoable : false});

});

test("Test push item", () => {
    builder.withObj({
        ...NORTH_ROOM,
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        exits : {
            north : "northRoom"
        }
    })
    builder.withObj({
        id : "box",
        type : "item",
        location : "northRoom",
        tags : ["pushable"]
    });
    engine.ref = builder.build();
    engine.send(Input.start()); 

    executeAndTest(["look"], { expected : ["box"]});
    let words = getWordIds([]);
    expect(words).toContain("push");

    words = getWordIds(["push"]);
    expect(words).toContain("box");

    words = getWordIds(["push", "box"]);
    expect(words).toContain("south");

    executeAndTest(["push", "box", "south"], { expected : ["Pushed", "box", "south"]});

    executeAndTest(["look"], { notExpected : ["box"]});

    executeAndTest(["go", "south"], {});

    executeAndTest(["look"], { expected : ["box"]});
})

test("Test push item blocked", () => {
    builder.withObj({
        ...NORTH_ROOM,
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        exits : {
            north : "northRoom"
        }
    })
    builder.withObj({
        id : "box",
        type : "item",
        location : "northRoom",
        tags : ["pushable"],
        before : {
            "push(this, $direction)" : {
                do : [
                    "print('cannot push')",
                    "print(direction)",
                    "return(false)"
                ]
            }
        }
    });
    engine.ref = builder.build();
    engine.send(Input.start()); 

    executeAndTest(["push", "box", "south"], { expected : ["cannot push", "south"]});
});

test("Test dark room", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "dark"]
    }).withObj({
        id : "ball",
        type : "item",
        location : "northRoom",
        tags : ["carryable"]
    })
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["dark"], notExpected : ["ball"]});
});

test("Test dark room with lightsource", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "dark"]
    }).withObj({
        id : "ball",
        type : "item",
        location : "northRoom",
        tags : ["carryable"]
    }).withObj({
        id : "torch",
        type : "item",
        location : "northRoom",
        tags : ["carryable", "lightSource"]
    })
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["ball", "torch"], notExpected : ["dark"]});
});

test("Test dark room with lightsource in inventory", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "dark"]
    }).withObj({
        id : "ball",
        type : "item",
        location : "northRoom",
        tags : ["carryable"]
    }).withObj({
        id : "torch",
        type : "item",
        location : "__INVENTORY__",
        tags : ["carryable", "lightSource"]
    })
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["ball"], notExpected : ["dark", "torch"]});
})

test("Test dark room can still move", () => {
    builder.withObj({
        ...NORTH_ROOM,
        exits : {
            "south" : "southRoom"
        },
        tags : ["start", "dark"]
    }).withObj({
        ...SOUTH_ROOM,
        exits : {
            "north" : "northRoom"
        },
        tags : ["dark"]
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    
    const words = getWordIds([]);
    expect(words).toContain("go");

    const goWords = getWordIds(["go"]);
    expect(goWords).toContain("south");
});

test("Test dark room can wait", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "dark"]
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    
    const words = getWordIds([]);
    expect(words).toContain("wait");

    executeAndTest(["wait"], {expected : ["Time passes"]});
});

test("Test visibleWhenDarkTag", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "dark"]
    }).withObj({
        id : "ball",
        type : "item",
        location : "northRoom",
        tags : ["carryable"]
    }).withObj({
        id : "stickers",
        description : "glow in the dark stickers",
        type : "item",
        location : "northRoom",
        tags : ["carryable", "visibleWhenDark"]
    })
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { notExpected : ["ball", "stickers"]}); // should we see stickers?
    const words = getWordIds(["get"]);
    expect(words).toContain("stickers");
    expect(words).not.toContain("ball");
});

test("Test visibleWhen function", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "dark"]
    }).withObj({
        id : "stickers",
        description : "glow in the dark stickers",
        type : "item",
        location : "northRoom",
        "visibleWhen()" : "hasTag(location, 'dark')",
        tags : ["carryable"]
    })
    engine.ref = builder.build();
    engine.send(Input.start()); 

    const words = getWordIds(["get"]);
    expect(words).toContain("stickers");

})

test("Test custom function", () => {
   builder.withObj({
    ...THE_ROOM,
    "foo()" : "print('bar')",
    "baz(qux)" : "print('baz' + qux)",
    "corge(grault, xyzzy)" : "print(grault + xyzzy)"
   }); 
   builder.withObj({
        id : "customFns",
        type : "rule",
        "afterTurn()" : ["theRoom.foo()", "theRoom.baz('one')", "theRoom.corge('two', 'three')"]
   })
   engine.ref = builder.build();
   engine.send(Input.start());
   executeAndTest(["wait"], { expected : [ "bar", "bazone", "twothree"]});
});

test("Test custom function scope", () => {
   builder.withObj({
    ...THE_ROOM,
    "myvar" : "bar",
    "foo1()" : "print('foo1' + myvar)",
    "foo2()" : "print('foo2' + this.myvar)",
    "foo3()" : "print('foo3' + theRoom.myvar)",
    "foo4()" : "print('foo4' + anItem.itemvar)",
    "baz(qux)" : "print(qux + anItem.fnItem())"
   }); 
   builder.withObj({
    ...ORDINARY_ITEM,
    "itemvar" : "xyzzy",
    "fnItem()" : "'quux'"
   })
   builder.withObj({
        id : "customFns",
        type : "rule",
        "afterTurn()" : ["theRoom.foo1()", "theRoom.foo2()", "theRoom.foo3()", "theRoom.foo4()","theRoom.baz('qux')"]
   })
   engine.ref = builder.build();
   engine.send(Input.start());
   executeAndTest(["wait"], { expected : [ "foo1bar", "foo2bar", "foo3bar", "foo4xyzzy", "quxquux"]});
});

test("Test custom functions in child object", () => {
    builder.withObj({
        ...THE_ROOM,
        myvar : "bar",
        "foo1()" : "'foo1' + ' ' + myvar",
        child : {
            myvar : "baz",
            "foo2()" : "'foo2' + ' ' + myvar",
            "foo3()" : "'foo3' + ' ' + foo1() + ' ' + foo2()"
        },
        "afterTurn()" : [
            "print('1 ' + foo1())",
            "print('2 ' + child.foo2())",
            "print('3 ' + child.foo3())",
        ]
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : [
        "1 foo1 bar",
        "2 foo2 baz",
        "3 foo3 foo1 bar foo2 baz"
    ]});
});

test("Test location change events", () => {
    builder.withObj({
        ...NORTH_ROOM,
        exits : {
            south : "southRoom"
        },
        "onAddChild(child)" : "print('north room hello ' + child.id)",
        "onRemoveChild(child)" : "print('north room goodbye ' + child.id)"
    });
    builder.withObj({
        ...SOUTH_ROOM,
        exits : {
            north : "northRoom"
        },
        "onAddChild(child)" : "print('south room hello ' + child.id)",
        "onRemoveChild(child)" : "print('south room goodbye ' + child.id)"
    });
    builder.withObj({
        id : "ball",
        type : "item",
        location : "northRoom",
        "onMove(newLoc)" : "print('The ball bounces to ' + newLoc.id)"
    });
    builder.withObj({
        id : "moveBall",
        type : "rule",
        "afterTurn()" : {
            repeat : ["move(ball).to(southRoom)", "move(ball).to(northRoom)"]
        }
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["The ball bounces to southRoom", "north room goodbye ball", "south room hello ball"],
                               notExpected : ["south room goodbye ball", "north room hello ball"]});
    executeAndTest(["wait"], { expected : ["The ball bounces to northRoom", "south room goodbye ball", "north room hello ball"],
                               notExpected : ["north room goodbye ball", "south room hello ball"]});
    executeAndTest(["wait"], { expected : ["The ball bounces to southRoom", "north room goodbye ball", "south room hello ball"],
                               notExpected : ["south room goodbye ball", "north room hello ball"]});
    executeAndTest(["wait"], { expected : ["The ball bounces to northRoom", "south room goodbye ball", "north room hello ball"],
                               notExpected : ["north room goodbye ball", "south room hello ball"]});

});

test("NPC implicit onMove", () => {
    builder.withObj({
        ...NORTH_ROOM,
        exits : {
            south : "southRoom"
        },
    });
    builder.withObj({
        ...SOUTH_ROOM,
        exits : {
            north : "northRoom"
        },
    });
    builder.withObj({
        id : "ball",
        name : "the ball",
        type : "item",
        location : "northRoom",
        tags : ["NPC"]
    });
    builder.withObj({
        id : "moveBall",
        type : "rule",
        "afterTurn()" : {
            repeat : ["move(ball).to(southRoom)", "move(ball).to(northRoom)"]
        }
    })
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["wait"], { expected : ["the ball leaves south"] });
    executeAndTest(["wait"], { expected : ["the ball enters from the south"] });
});

test("NPC onMove with custom messages", () => {
    builder.withObj({
        ...NORTH_ROOM,
        exits : {
            south : "southRoom"
        },
    });
    builder.withObj({
        ...SOUTH_ROOM,
        exits : {
            north : "northRoom"
        },
    });
    builder.withObj({
        id : "trolley",
        name : "shopping trolley",
        description : "A battered old shopping trolley",
        type : "item",
        location : "northRoom",
        tags : ["NPC", "container"],
        properties : {
            location : {
                messages : {
                    leaves : "The trolley rolls {{direction}}",
                    arrives : "The trolley rolls from {{direction}}"
                }
            }
        }
    });
    builder.withObj({
        id : "banana",
        name : "banana",
        type : "item",
        location : "trolley"
    });
    builder.withObj({
        id : "moveBall",
        type : "rule",
        "afterTurn()" : {
            repeat : ["move(trolley).to(southRoom)", "move(trolley).to(northRoom)"]
        }
    })
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["examine", "trolley"], { expected : ["A battered old shopping trolley", "banana"] });
    executeAndTest(["wait"], { expected : ["The trolley rolls south"] });
    executeAndTest(["wait"], { expected : ["The trolley rolls from south"] });
});

test("Test moveItemTo with custom messages", () => {
    builder.withObj({
        ...NORTH_ROOM,
        exits : {
            south : "southRoom"
        },
    });
    builder.withObj({
        ...SOUTH_ROOM,
        exits : {
            north : "northRoom"
        },
    });
    builder.withObj({
        id : "trolley",
        name : "shopping trolley",
        description : "A battered old shopping trolley",
        type : "item",
        location : "northRoom",
        tags : ["NPC", "container"],
        properties : {
            location : {
                messages : {
                    leaves : "The trolley rolls {{direction}}",
                    arrives : "The trolley rolls from {{direction}}"
                }
            }
        }
    });
    builder.withObj({
        id : "banana",
        name : "banana",
        type : "item",
        location : "trolley"
    });
    builder.withObj({
        id : "moveBall",
        type : "rule",
        "afterTurn()" : {
            repeat : ["moveItemTo(trolley,southRoom)", "moveItemTo(trolley,northRoom)"]
        }
    })
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["examine", "trolley"], { expected : ["A battered old shopping trolley", "banana"] });
    executeAndTest(["wait"], { expected : ["The trolley rolls south"] });
    executeAndTest(["wait"], { expected : ["The trolley rolls from south"] });
});

test("Test mustache in expression strings", () => {
    builder.withObj({
        ...NORTH_ROOM,
        foo : "bar",
        "afterTurn()" : {
            repeat: [["print('this.foo == {{this.foo}}')", "this.foo = '{{this.id}}'"], "print('this.foo == {{this.foo}}')"]
        }
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["this.foo == bar"] });
    executeAndTest(["wait"], { expected : ["this.foo == northRoom"] });
});

test("Test mustache in object property", () => {
    builder.withObj({
        ...NORTH_ROOM,
        foo : "bar",
        qux : "qux {{foo}}",
        baz : "xyzzy",
        "afterTurn()" : ["print(this.baz)", "print(this.qux)"]
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["xyzzy", "qux bar"]});
});

test("Test mustache firstTime in expression string", () => {
    builder.withObj({
        ...NORTH_ROOM,
        foo : "bar",
        baz : "qux",
        "afterTurn()" : [
            "print('{{#firstTime}}{{this.foo}}{{/firstTime}}{{^firstTime}}{{this.baz}}{{/firstTime}}')"
        ]
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { errors : ["Error formatting"]});
})

test("Test mustache firstTime in property string", () => {
    builder.withObj({
        ...NORTH_ROOM,
        foo : "bar",
        baz : "qux",
        xyzzy: '{{#firstTime}}{{this.foo}}{{/firstTime}}{{^firstTime}}{{this.baz}}{{/firstTime}}',
        "afterTurn()" : [
            "print(this.xyzzy)"
        ]
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["bar"], notExpected : ["qux"]});
    executeAndTest(["wait"], { expected : ["qux"], notExpected : ["bar"]});
});

test("Test mustache in child property", () => {
    builder.withObj({
        ...NORTH_ROOM,
        foo : "bar",
        child : {
            foo : "childfoo",
            quux : "quux {{foo}}",
            gchild : {
                quux : "gchild quux {{foo}}"
            }
        },
        baz : "baz {{foo}}",
        "afterTurn()" : [
            "print(this.baz)",
            "print(this.child.quux)",
            "print(this.child.gchild.quux)"
        ]
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["baz bar", "quux childfoo", "gchild quux childfoo"]});
});

test("Test mustache in array", () => {
    builder.withObj({
        ...NORTH_ROOM,
        foo : "bar",
        baz : [
            "baz0 {{foo}}",
            "baz1",
            {
                "qux" : "qux {{foo}}",
                "quux" : "quux {{0}} {{1}}"
            }
        ],
        "afterTurn()" : [
            "print(this.baz[0])",
            "print(this.baz[1])",
            "print(this.baz[2].qux)",
            "print(this.baz[2].quux)"
        ]
    })
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["baz0 bar", "baz1", "qux bar", "quux baz0 bar baz1"]});
});

test("Test verb context", () => {
    builder.withObj({
        ...NORTH_ROOM
    });
    builder.withObj({
        id : "cloak",
        type : "item",
        tags : ["carryable", "wearable"],
        location : "northRoom",
        verbs : ["hang"]
    });
    builder.withObj({
        id : "hook",
        type : "item",
        location : "northRoom",
        verbs : ["hang.on"]
    });
    builder.withObj({
        id : "hang",
        type : "verb",
        tags : ["transitive"],
        contexts : ["inventory", "wearing"],
        attributes : ["on"],
        actions : {
            "hang($hangable).on($hanger)" : "moveItemTo(hangable, hanger)"
        }
    });

    engine.ref = builder.build();
    engine.send(Input.start());

    expect(getWordIds([])).not.toContain("hang");

    executeAndTest(["get", "cloak"], {});
    expect(getWordIds([])).toContain("hang");

    executeAndTest(["wear", "cloak"], {});
    expect(getWordIds([])).toContain("hang");

    executeAndTest(["hang", "cloak", "on", "hook"], {});
    expect(getWordIds([])).not.toContain("hang");
});

test("Test ignore context", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "pseudoRoom"]
    });
    engine.ref = builder.build();
    engine.send(Input.start());

    const words = getWordIds([]);
    expect(words).toHaveLength(0);
});

test("Test ignore context with location defined verb", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "pseudoRoom"],
        verbs : ["continue"],
        before : {
            continue : "print('continuing')"
        }
    });
    builder.withObj({
        id : "continue",
        type : "verb",
        tags : ["intransitive"]
    })
    engine.ref = builder.build();
    engine.send(Input.start());

    const words = getWordIds([]);
    expect(words).toHaveLength(1);
    expect(words).toContain("continue");

    executeAndTest(["continue"], { expected : ["continuing"]});

});

test("Test custom verb modifier", () => {
    builder.withObj({
        ...NORTH_ROOM
    }).withObj({
        id : "lever",
        type : "item",
        location : "northRoom",
        verbs : ["pull"],
        modifiers : {
            lever_dir : [ "up", "down"]
        },
        before : {
            "pull(this, $lever_dir)" : "print('pulling ' + lever_dir)"
        }
    }).withObj({
        id : "pull",
        type : "verb",
        tags : ["transitive"],
        modifiers : ["lever_dir"]
    });
    engine.ref = builder.build();
    engine.send(Input.start());

    expect(getWordIds([])).toContain("pull");
    expect(getWordIds(["pull"])).toContain("lever");
    const lever_dirs = getWordIds(["pull", "lever"]);
    expect(lever_dirs).toContain("up");
    expect(lever_dirs).toContain("down");
    
    executeAndTest(["pull", "lever", "up"], { expected : ["pulling up"]});
    executeAndTest(["pull", "lever", "down"], { expected : ["pulling down"]});
})

test("Test conditional verb modifier", () => {  
    builder.withObj({
        ...NORTH_ROOM
    }).withObj({
        id : "lever",
        type : "item",
        location : "northRoom",
        verbs : ["pull"],
        isLeverUp : false,
        modifiers : {
            lever_dir : [ { "up" : "not(isLeverUp)", "down" : "isLeverUp" } ]
        },
        before : {
            "pull(this, $lever_dir)" : [
                "print('pulling ' + lever_dir)",
                {
                    "when" : "lever_dir == 'up'",
                    "do" : "isLeverUp = true"
                },
                {
                    "when" : "lever_dir == 'down'",
                    "do" : "isLeverUp = false"
                },
                "return(true)"
            ]
        }
    }).withObj({
        id : "pull",
        type : "verb",
        tags : ["transitive"],
        modifiers : ["lever_dir"]
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    
    expect(getWordIds([])).toContain("pull");
    expect(getWordIds(["pull"])).toContain("lever");
    const lever_dirs = getWordIds(["pull", "lever"]);
    expect(lever_dirs).toContain("up");
    expect(lever_dirs).not.toContain("down");

    executeAndTest(["pull", "lever", "up"], { expected : ["pulling up"]});
    
    expect(getWordIds([])).toContain("pull");
    expect(getWordIds(["pull"])).toContain("lever");
    const lever_dirs2 = getWordIds(["pull", "lever"]);
    expect(lever_dirs2).not.toContain("up");
    expect(lever_dirs2).toContain("down");
});

test("Test undefined/defined value as when rule", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                "id" : "numbers",
                "type" : "item",
                "location" : "northRoom",
                "theList" : ["foo", "bar", "baz"],
                "afterTurn()" : [
                        "qux = Array.find(theList, fn([item], item == 'qux'))",
                        {
                            "when" : "qux",
                            "then" : "print(qux)",
                            "else" : "print('NO QUX')"
                        }
                    ]
                }
           );
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["NO QUX"]});
});