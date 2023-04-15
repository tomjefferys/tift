import { BasicEngine, Engine } from "../src/engine";
import { EngineBuilder } from "../src/builder/enginebuilder";
import { listOutputConsumer, SaveData, getEmptyHistory } from "./testutils/testutils";
import { Input } from "../src/main";
import { THE_ROOM, ORDINARY_ITEM, OTHER_ITEM, YET_ANOTHER_ITEM, NORTH_ROOM, SOUTH_ROOM, GOBLIN } from "./testutils/testobjects";
import { STANDARD_VERBS } from "./testutils/testutils";

let messages : string[];
let wordsResponse : string[];
let statuses : string[]
let saveData : SaveData;
let builder : EngineBuilder;
let engine : Engine;

beforeEach(() => {
    messages = [];
    wordsResponse = [];
    statuses = [];
    saveData = { data : getEmptyHistory() };
    builder = new EngineBuilder().withOutput(listOutputConsumer(messages, wordsResponse, saveData, statuses));
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
        do : ["print('hello world')"]
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
        builder.withObj(THE_ROOM);
        builder.withObj({
            id : "key",
            type : "item",
            location : "theRoom",
            tags : ["carryable"]
        });
        builder.withConfigEntry("undoLevels", 0);
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

    // Check the save data is empty
    expect(saveData.data.baseHistory).toEqual([]);
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
        rules : ["print(this.myvar)"],
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        desc : "The room is light and round",
        myvar : "bar",
        rules : ["this.myvar"],
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
        rules : { "repeat" : ["'foo'", "'bar'", "'baz'"] } 
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
        rules : { "repeat" : ["'foo'", { "repeat" : ["'bar'", "'baz'"] } , "'qux'"] } 
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
        repeat: ["do(print('The goblin goes south'), move('goblin').to('southRoom'))",
                        "do(print('The goblin goes north'), move('goblin').to('northRoom'))"]
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
        do: "'wooo-oo'"
    })
    builder.withObj({
        id:"globalMonster",
        type:"rule",
        do: "'grr'"
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

    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":1}]);

    executeAndTest(["examine", "rubbish"], { expected : ["tin can"], notExpected : ["mouldy bread", "banana peel"]});
    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":2}]);

    executeAndTest(["examine", "rubbish"], { expected : ["banana peel"], notExpected : ["tin can", "moudly bread"]});
    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":0}]);

    executeAndTest(["examine", "rubbish"], { expected : ["mouldy bread"], notExpected : ["tin can", "banana peel"]});
    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":1}]);

    executeAndTest(["examine", "rubbish"], { expected : ["tin can"], notExpected : ["mouldy bread", "banana peel"]});
    expect(saveData.data.baseHistory).toStrictEqual([{"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":2}]);

    executeAndTest(["examine", "rubbish"], { expected : ["banana peel"], notExpected : ["tin can", "moudly bread"]});
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
    expect(saveData.data.baseHistory).toStrictEqual([
        {"type":"Set","property":["entities","rubbish","after","0","repeat","index"],"newValue":1}]
    );

    executeAndTest(["examine", "rubbish"], { expected : ["bar"], notExpected : ["foo", "baz"]});
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

    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in box"] });
    executeAndTest(["get", "ball"], {});
    executeAndTest(["look"], { notExpected : ["ball", "in box"] });
    executeAndTest(["put", "ball", "in", "box"], {});
    executeAndTest(["look"], { expected : ["ball", "in box"] });

    // Try undoing
    engine.send(Input.undo());
    executeAndTest(["look"], { notExpected : ["ball", "in box"] });
    engine.send(Input.undo());
    executeAndTest(["look"], { expected : ["ball"], notExpected : ["in box"] });

    // Try redoing
    engine.send(Input.redo());
    executeAndTest(["look"], { notExpected : ["ball", "in box"] });
    engine.send(Input.redo());
    executeAndTest(["look"], { expected : ["ball", "in box"] });

})

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

test("Test math functions", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "mathFns",
        type : "rule",
        do : ["a=1", "b=2", "c = 3", "print(Math.min(b,a,c))"]
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
        do : ["do(text = 'hello world', print(String.substr(text, 1, 4))), print(String.length(text))"]
    })
    engine = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["Time passes", "ello", "11"], notExpected : ["failed"] });
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