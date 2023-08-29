import { BasicEngine } from "../src/engine";
import { EngineBuilder } from "../src/builder/enginebuilder";
import { listOutputConsumer, SaveData, getEmptyHistory, loadDefaults } from "./testutils/testutils";
import { Input } from "../src/main";
import { THE_ROOM, ORDINARY_ITEM, OTHER_ITEM, YET_ANOTHER_ITEM, NORTH_ROOM, SOUTH_ROOM, GOBLIN, GAME_METADATA } from "./testutils/testobjects";
import { STANDARD_VERBS } from "./testutils/testutils";
import { StatusType } from "tift-types/src/messages/output";
import { Engine } from "tift-types/src/engine"

let messages : string[];
let wordsResponse : string[];
let statuses : StatusType[]
let saveData : SaveData;
let builder : EngineBuilder;
let engine : Engine;

beforeEach(() => {
    messages = [];
    wordsResponse = [];
    statuses = [];
    saveData = { data : getEmptyHistory() };
    builder = new EngineBuilder().withOutput(listOutputConsumer(messages, wordsResponse, saveData, statuses));
    builder.withObj(GAME_METADATA);
    loadDefaults(builder);
});

test("Test single room, no exits", () => {
    builder.withObj(NORTH_ROOM)
    engine = builder.build();
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
    engine = builder.build();
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
    engine = builder.build();
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

    expectWords([], [...STANDARD_VERBS, "get"]);
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
        desc : "A little teapot, {{dimensions}}",
        dimensions : "short and stout"
    })
    engine = builder.build();
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
    engine = builder.build();
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
    engine = builder.build();
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
    engine = builder.build();
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

    engine = builder.build();
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
    engine = builder.build();
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

    const config = {
        "autoLook" : true,
        undoLevels : 0 
    };

    builder.withConfig(config);

    engine = builder.build();
    
    engine.send(Input.start());

    expect(messages.join()).toContain("The room is dark and square");
    messages.length = 0;

    executeAndTest(["go", "south"], { expected : [ "The room is light and round" ] })
    const saveStr = JSON.stringify(saveData.data);

    engine = builder.build();
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

    expect(saveData.data.baseHistory).toEqual(
        [{"type":"Set", "property":["entities", "key", "location"], "newValue":"__INVENTORY__"}])
});

test("Test reset", () => {
    // Need to recreate the builder later, so store constructions as a lambda
    const getBuilder = () => {
        const builder = new EngineBuilder().withOutput(listOutputConsumer(messages, wordsResponse, saveData, statuses));
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
    engine = getBuilder().build();
    engine.send(Input.start());
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});

    // Get the key
    executeAndTest(["get", "key"], {});
    executeAndTest(["look"], { expected : ["An almost empty room"], notExpected : ["key"]});

    // Reset the engine
    engine.send(Input.reset());
    getBuilder().addTo(engine as BasicEngine);
    engine.send(Input.start());

    // The key should be back in place
    executeAndTest(["look"], { expected : ["An almost empty room", "key"]});
})

test("Test command deduplication", () => {
    engine = builder.withObj(THE_ROOM)
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
        desc : "The room is dark and square",
        myvar : "foo",
        "afterTurn()" : ["print(this.myvar)"],
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        desc : "The room is light and round",
        myvar : "bar",
        "afterTurn()" : ["this.myvar"],
        exits : {
            north : "northRoom"
        }
    })
    engine = builder.build();
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
        desc : "The room is dark and square",
        myvar : "foo",
        "afterTurn()" : { "repeat" : ["'foo'", "'bar'", "'baz'"] } 
    });
    engine = builder.build();
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
        desc : "The room is dark and square",
        myvar : "foo",
        "afterTurn()" : { "repeat" : ["'foo'", { "repeat" : ["'bar'", "'baz'"] } , "'qux'"] } 
    });
    engine = builder.build();
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
        desc : "The room is dark and square",
        myvar : "foo",
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        desc : "The room is light and round",
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
    engine = builder.build();
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

test("Test scoped rules", () => {
    builder.withObj({
        ...NORTH_ROOM,
        name : "The North Room",
        desc : "The room is dark and square",
        myvar : "foo",
        exits : {
            south : "southRoom"
        },
    });
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        desc : "The room is light and round",
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
    engine = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["grr"], notExpected : ["wooo-oo"]});
    executeAndTest(["go", "south"], { expected : ["grr", "wooo-oo"]});
    executeAndTest(["wait"], { expected : ["grr", "wooo-oo"]});
    executeAndTest(["go", "north"], { expected : ["grr"], notExpected : ["wooo-oo"]});
})

test("Test hiding/revealing object", () => {
    builder.withObj({...NORTH_ROOM })
           .withObj({
                id : "diamond",
                type : "item",
                location : "rubbish",
                tags : ["carryable", "hidden"]
            })
            .withObj({
                id : "can",
                type : "item",
                location : "rubbish",
                tags : ["carryable"]
            })
            .withObj({
                id : "rubbish",
                desc: "A pile of stinking rubbish",
                type : "item",
                location : "northRoom",
                after : {
                    "examine(this)" : "if(hasTag('diamond','hidden')).then(do(reveal('diamond'), 'You find a diamond'))",
                }
            })
           .withConfigEntry("undoLevels", 0);
    engine = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["can", "in rubbish"], notExpected : ["diamond"]});
    expectWords(["get"], ["can"]);

    executeAndTest(["examine", "rubbish"], { expected : ["You find a diamond"]} );
    executeAndTest(["look"], { expected : ["can", "diamond", "in rubbish"]});
    executeAndTest(["examine", "rubbish"], { expected : ["A pile of stinking rubbish"], notExpected : ["You find a diamond"]} );
    executeAndTest(["wait"], {}); // TODO maybe introduce explict save command to force save data to be gnerated

    expect(saveData.data.baseHistory.length).toBe(2);
    expect(saveData.data.baseHistory[0]).toStrictEqual({"type":"Del","property":["entities","diamond","tags","1"]});
    expect(saveData.data.baseHistory[1]).toStrictEqual({"type":"Set","property":["entities","diamond","tags","length"],"newValue":1})

    expectWords(["get"], ["can", "diamond"]);
    executeAndTest(["get", "diamond"], {});
    executeAndTest(["look"], { expected : ["can", "in rubbish"], notExpected : ["diamond"]});
    executeAndTest(["examine", "rubbish"], { expected : ["A pile of stinking rubbish"], notExpected : ["You find a diamond"]} );

    expect(saveData.data.baseHistory.length).toBe(3);
    expect(saveData.data.baseHistory[2]).toStrictEqual({"type":"Set","property":["entities","diamond","location"],"newValue":"__INVENTORY__"});
});

test("Test action with repeat", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
               id : "rubbish",
               desc : "A pile of stinking rubbish",
               type : "item",
               location : "northRoom",
               after : {
                   "examine(this)" : {
                       repeat : ["'You see some mouldy bread'", "'You see an old tin can'", "'You see a banana peel'"]
                   }
               }
           })
          .withConfigEntry("undoLevels", 0);
    engine = builder.build();
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
               desc : "A pile of stinking rubbish",
               type : "item",
               location : "northRoom",
               after : {
                   "examine(this)" : {
                       repeat : ["'foo'", { repeat : ["'bar'", "'baz'"] } ]
                   }
               }
           })
          .withConfigEntry("undoLevels", 0);
    engine = builder.build();
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
                desc : "A threadbare armchair.  {{#sat_on}}sitting{{/sat_on}} {{^sat_on}}standing{{/sat_on}}",
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
    engine = builder.build();
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
                desc : "A threadbare armchair.  {{#sat_on}}sitting{{/sat_on}} {{^sat_on}}standing{{/sat_on}}",
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
    engine = builder.build();
    engine.send(Input.start());

    let words = getWordIds(engine, []);
    expect(words.includes("sit")).toBeTruthy();
    expect(words.includes("stand")).toBeFalsy();

    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "standing"], notExpected : ["sitting"]});
    executeAndTest(["sit", "armchair"], { expected : ["You sit down"] });
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "sitting"], notExpected : ["standing"]});

    words = getWordIds(engine, []);
    expect(words.includes("sit")).toBeFalsy();
    expect(words.includes("stand")).toBeTruthy();

    // Test undo resets things correctly
    engine.send(Input.undo());
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "standing"], notExpected : ["sitting"]});
    words = getWordIds(engine, []);
    expect(words.includes("sit")).toBeTruthy();
    expect(words.includes("stand")).toBeFalsy();

    engine.send(Input.redo());
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "sitting"], notExpected : ["standing"]});
    words = getWordIds(engine, []);
    expect(words.includes("sit")).toBeFalsy();
    expect(words.includes("stand")).toBeTruthy();

    executeAndTest(["stand"], { expected : ["You stand up"] });
    executeAndTest(["examine", "armchair"], { expected : ["A threadbare armchair", "standing"], notExpected : ["sitting"]});

});

test("Test put item in container", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "box",
                desc : "A large wooden box",
                location : "northRoom",
                type : "item",
                verbs : ["put.in"]
           })
           .withObj({
                id : "ball",
                desc : "A small ball",
                location : "northRoom",
                type : "item",
                tags : ["carryable"]
           });
    engine = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in box"] });
    executeAndTest(["get", "ball"], {});
    executeAndTest(["look"], { notExpected : ["ball", "in box"] });
    executeAndTest(["put", "ball", "in", "box"], {});
    executeAndTest(["look"], { expected : ["ball", "in box"] });
})

test("Test undo", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "box",
                desc : "A large wooden box",
                location : "northRoom",
                type : "item",
                verbs : ["put.in"]
           })
           .withObj({
                id : "ball",
                desc : "A small ball",
                location : "northRoom",
                type : "item",
                tags : ["carryable"]
           });
    engine = builder.build();
    engine.send(Input.start());
    expectStatus({undoable : false, redoable : false});

    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in box"] });
    expectStatus({undoable : false, redoable : false});

    executeAndTest(["get", "ball"], {});
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["look"], { notExpected : ["ball", "in box"] });
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["put", "ball", "in", "box"], {});
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["look"], { expected : ["ball", "in box"] });
    expectStatus({undoable : true, redoable : false});

    // Try undoing
    engine.send(Input.undo());
    executeAndTest(["look"], { notExpected : ["ball", "in box"] });
    expectStatus({undoable : true, redoable : true});

    engine.send(Input.undo());
    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in box"] });
    expectStatus({undoable : false, redoable : true});

    // Try redoing
    engine.send(Input.redo());
    executeAndTest(["look"], { notExpected : ["ball", "in box"] });
    expectStatus({undoable : true, redoable : true});

    engine.send(Input.redo());
    executeAndTest(["look"], { expected : ["ball", "in box"] });
    expectStatus({undoable : true, redoable : false});
})

test("Test undo, clear redo on new action", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({
                id : "box",
                desc : "A large wooden box",
                location : "northRoom",
                type : "item",
                verbs : ["put.in"]
           })
           .withObj({
                id : "ball",
                desc : "A small ball",
                location : "northRoom",
                type : "item",
                tags : ["carryable"]
           });
    engine = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in box"] });
    executeAndTest(["get", "ball"], {});
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["look"], { notExpected : ["ball", "in box"] });
    executeAndTest(["put", "ball", "in", "box"], {});
    expectStatus({undoable : true, redoable : false});

    executeAndTest(["look"], { expected : ["ball", "in box"] });

    // Try undoing
    engine.send(Input.undo());
    executeAndTest(["look"], { notExpected : ["ball", "in box"] });
    expectStatus({undoable : true, redoable : true});
    executeAndTest(["drop", "ball"], {});
    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in box"] });
    expectStatus({undoable : true, redoable : false});

    // Try redoing, nothing should change
    engine.send(Input.redo());
    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in box"] });
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
    engine = builder.build();
    engine.send(Input.start()); 

    executeAndTest(["look"], { expected : ["box"]});
    let words = getWordIds(engine, []);
    expect(words).toContain("push");

    words = getWordIds(engine, ["push"]);
    expect(words).toContain("box");

    words = getWordIds(engine, ["push", "box"]);
    expect(words).toContain("south");

    executeAndTest(["push", "box", "south"], { expected : ["Pushed", "box", "south"]});

    executeAndTest(["look"], { notExpected : ["box"]});

    executeAndTest(["go", "south"], {});

    executeAndTest(["look"], { expected : ["box"]});
})

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
    engine = builder.build();
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
    engine = builder.build();
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
    engine = builder.build();
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
    engine = builder.build();
    engine.send(Input.start());
    
    const words = getWordIds(engine, []);
    expect(words).toContain("go");

    const goWords = getWordIds(engine, ["go"]);
    expect(goWords).toContain("south");
});

test("Test dark room can wait", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "dark"]
    });
    engine = builder.build();
    engine.send(Input.start());
    
    const words = getWordIds(engine, []);
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
        desc : "glow in the dark stickers",
        type : "item",
        location : "northRoom",
        tags : ["carryable", "visibleWhenDark"]
    })
    engine = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { notExpected : ["ball", "stickers"]}); // should we see stickers?
    const words = getWordIds(engine, ["get"]);
    expect(words).toContain("stickers");
    expect(words).not.toContain("ball");
});

test("Test visibleWhen function", () => {
    builder.withObj({
        ...NORTH_ROOM,
        tags : ["start", "dark"]
    }).withObj({
        id : "stickers",
        desc : "glow in the dark stickers",
        type : "item",
        location : "northRoom",
        "visibleWhen()" : "hasTag(location, 'dark')",
        tags : ["carryable"]
    })
    engine = builder.build();
    engine.send(Input.start()); 

    const words = getWordIds(engine, ["get"]);
    expect(words).toContain("stickers");

})

test("Test math functions", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "mathFns",
        type : "rule",
        "afterTurn()" : ["a=1", "b=2", "c = 3", "print(Math.min(b,a,c))"]
    })
    engine = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["Time passes", "1"], notExpected : ["failed"] });
});

test("Test string functions", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "mathFns",
        type : "rule",
        "afterTurn()" : ["do(text = 'hello world', print(String.substr(text, 1, 4))), print(String.length(text))"]
    })
    engine = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["Time passes", "ello", "11"], notExpected : ["failed"] });
});

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
   engine = builder.build();
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
   engine = builder.build();
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
    engine = builder.build();
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
    engine = builder.build();
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
    engine = builder.build();
    engine.send(Input.start());

    executeAndTest(["wait"], { expected : ["the ball leaves south"] });
    executeAndTest(["wait"], { expected : ["the ball enters from the south"] });
});

test("Test mustache in expression strings", () => {
    builder.withObj({
        ...NORTH_ROOM,
        foo : "bar",
        "afterTurn()" : {
            repeat: [["print('this.foo == {{this.foo}}')", "this.foo = '{{this.id}}'"], "print('this.foo == {{this.foo}}')"]
        }
    });
    engine = builder.build();
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
    engine = builder.build();
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
    engine = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["Error formatting"]});
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
    engine = builder.build();
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
    engine = builder.build();
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
    engine = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["baz0 bar", "baz1", "qux bar", "quux baz0 bar baz1"]});
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

function expectStatus(expected : Partial<StatusType>) {
    engine.send(Input.getStatus());
    const actual = statuses.at(-1);
    expect(actual).not.toBeUndefined();
    if (actual) {
        for(const [name, value] of Object.entries(expected)) {
            expect(actual[name as keyof StatusType]).toBe(value);
        }
    }
    statuses.length = 0;
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