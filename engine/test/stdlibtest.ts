import { EngineBuilder } from "../src/builder/enginebuilder";
import { SaveData, ExecuteAndTestFn, ExpectWordsFn, createEngineTestEnvironment, EngineRef } from "./testutils/testutils";
import { Input } from "../src/main";
import { THE_ROOM, NORTH_ROOM, SOUTH_ROOM } from "./testutils/testobjects";

let saveData : SaveData;
let builder : EngineBuilder;
let engine : EngineRef;
let executeAndTest : ExecuteAndTestFn;
let expectWords : ExpectWordsFn;

beforeEach(() => {
    const testEnvironment = createEngineTestEnvironment();
    builder = testEnvironment.builder;
    engine = testEnvironment.engine;
    saveData = testEnvironment.saveData;
    executeAndTest = testEnvironment.executeAndTest;
    expectWords = testEnvironment.expectWords;
});

test("Test tag functions", () => {
    builder.withObj({
        ...THE_ROOM,
        tags : ["start", "foo"],
        "afterTurn()" : [
            "print('1 ' + hasTag(theRoom, 'foo') + ',' + hasTag(theRoom, 'bar'))",
            "setTag(theRoom, 'bar')",
            "print('2 ' + hasTag(theRoom, 'foo') + ',' + hasTag(theRoom, 'bar'))",
            "delTag(theRoom, 'foo')",
            "print('3 ' + hasTag(theRoom, 'foo') + ',' + hasTag(theRoom, 'bar'))",
            "delTag(theRoom, 'bar')",
            "print('4 ' + hasTag(theRoom, 'foo') + ',' + hasTag(theRoom, 'bar'))",
            "delTag(theRoom, 'bar')",
            "print('5 ' + hasTag(theRoom, 'foo') + ',' + hasTag(theRoom, 'bar'))",
        ]
    });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : [
        "1 true,false",
        "2 true,true",
        "3 false,true",
        "4 false,false",
        "5 false,false"]});
});

test("Test math functions", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "mathFns",
        type : "rule",
        "afterTurn()" : ["a=1", "b=2", "c = 3", "print(Math.min(b,a,c))"]
    })
    engine.ref = builder.build();
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
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["wait"], { expected : ["Time passes", "ello", "11"], notExpected : ["failed"] });
});


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
                    "examine(this)" : "if(hasTag(diamond,'hidden')).then(do(reveal(diamond), 'You find a diamond'))",
                }
            })
           .withConfigEntry("undoLevels", 0);
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["can", "in the rubbish"], notExpected : ["diamond"]});
    expectWords(["get"], ["can"]);

    executeAndTest(["examine", "rubbish"], { expected : ["You find a diamond"]} );
    executeAndTest(["look"], { expected : ["can", "diamond", "in the rubbish"]});
    executeAndTest(["examine", "rubbish"], { expected : ["A pile of stinking rubbish"], notExpected : ["You find a diamond"]} );
    executeAndTest(["wait"], {}); // TODO maybe introduce explict save command to force save data to be gnerated

    expect(saveData.data.baseHistory.length).toBe(2);
    expect(saveData.data.baseHistory[0]).toStrictEqual({"type":"Del","property":["entities","diamond","tags","1"]});
    expect(saveData.data.baseHistory[1]).toStrictEqual({"type":"Set","property":["entities","diamond","tags","length"],"newValue":1})

    expectWords(["get"], ["can", "diamond"]);
    executeAndTest(["get", "diamond"], {});
    executeAndTest(["look"], { expected : ["can", "in the rubbish"], notExpected : ["diamond"]});
    executeAndTest(["examine", "rubbish"], { expected : ["A pile of stinking rubbish"], notExpected : ["You find a diamond"]} );

    expect(saveData.data.baseHistory.length).toBe(3);
    expect(saveData.data.baseHistory[2]).toStrictEqual({"type":"Set","property":["entities","diamond","location"],"newValue":"__INVENTORY__"});
});

test("Test isCarrying", () => {
    builder.withObj({...NORTH_ROOM})
        .withObj({id : "door",
                  type : "item",
                  location : "northRoom",
                  tags : ["openable"],
                  before :
                    { "open(this)" : {
                        "when": "isCarrying(key)",
                        "do": ["print('You open the door')", "open(door)"],
                        "otherwise": "print('You need a key to open the door')" }
                    }
                })
        .withObj({id : "key",
                    type : "item",
                    location : "northRoom",
                    tags : ["carryable"]});
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["open", "door"], { expected : ["You need a key to open the door"], notExpected : ["You open the door"]});
    executeAndTest(["get", "key"], {});
    executeAndTest(["open", "door"], { expected : ["You open the door"]});
});

test("Test open/close", () => {
    builder.withObj({...NORTH_ROOM})
        .withObj({id : "door",
                  type : "item",
                  location : "northRoom",
                  desc : "The green door",
                  tags : ["openable"],
                  before : {
                    "examine(this)": {
                        if: "this.is_open",
                        then: "print('The door is open')",
                        else: "print('The door is closed')"
                    }
                  }})
        .withObj({id : "key",
                  type : "item",
                  location : "northRoom",
                  tags : ["carryable"]});
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["examine", "door"], { expected : ["The door is closed"]});
    executeAndTest(["open", "door"], {} );
    executeAndTest(["examine", "door"], { expected : ["The door is open"]});
    executeAndTest(["close", "door"], {} );
    executeAndTest(["examine", "door"], { expected : ["The door is closed"]});
});

test("Test open un-openable", () => {
    builder.withObj({...NORTH_ROOM})
    .withObj({id : "key",
                type : "item",
                location : "northRoom",
                verbs : ["open"],
                tags : ["carryable"],
                before : {
                    "open(this)" : "open(this)"
                }});
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["open", "key"], { errors : ["You cannot open key"]});
})

test("Test lockable", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "door",
                        type : "item",
                        location : "northRoom",
                        desc : "The green door",
                        key : "brass_key",
                        tags : ["openable", "lockable", "locked"],
                        before : {
                            "examine(this)": {
                                if: "this.is_open",
                                then: "print('The door is open')",
                                else: "print('The door is closed')"
                            }
                        }})
            .withObj({id : "brass_key",
                        type : "item",
                        location : "northRoom",
                        verbs : ["unlock.with", "lock.with"],
                        tags : ["carryable"]});
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["examine", "door"], { expected : ["The door is closed"]});
    executeAndTest(["open", "door"], { expected : ["The door is locked"]});
    executeAndTest(["get","brass_key"], {});
    executeAndTest(["unlock", "door", "with", "brass_key"], { expected : ["You unlock the door."]});
    executeAndTest(["open", "door"], {});
    executeAndTest(["examine", "door"], { expected : ["The door is open"]});
    executeAndTest(["lock", "door", "with", "brass_key"], { expected : ["The door cannot be locked whilst it is open."]});
    executeAndTest(["close", "door"], {});
    executeAndTest(["lock", "door", "with", "brass_key"], { expected : ["You lock the door."]});
    executeAndTest(["examine", "door"], { expected : ["The door is closed"]});

});
    
test("Test container", () => {
    builder.withObj({...NORTH_ROOM})
        .withObj({id : "chest",
                    name : "chest",
                    type : "item",
                    location : "northRoom",
                    desc : "A large chest",
                    tags : ["container"]
                    })
                .withObj({id : "ball",
                          name : "ball",
                          type : "item",
                          location : "northRoom",
                          tags : ["carryable"]})
                .withObj({id : "cube",
                          name : "cube",    
                          type : "item", 
                          location : "northRoom",
                          tags : ["carryable"]});

    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["examine", "chest"], { expected : ["A large chest"], notExpected : ["ball", "cube"]});
    executeAndTest(["get", "ball"], {});
    executeAndTest(["get", "cube"], {});
    expectWords([], ["put"], false);
    expectWords(["put"], ["ball", "cube"]);
    executeAndTest(["put", "ball", "in", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "Inside", "ball"], notExpected : ["cube"]});
    executeAndTest(["put", "cube", "in", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "Inside", "ball", "cube"]});
    executeAndTest(["get", "ball"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "Inside", "cube"], notExpected : ["ball"]});
    executeAndTest(["get", "cube"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest"], notExpected : ["Inside", "ball", "cube"]});
})

test("Test container should not show contents if empty", () => {
    builder.withObj({...NORTH_ROOM})
        .withObj({id : "chest",
                    name : "chest",
                    type : "item",
                    location : "northRoom",
                    desc : "A large chest",
                    tags : ["container"]
                    });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["examine", "chest"], { expected : ["A large chest"], notExpected : ["Inside"]});
});

/**
 * Test that you can't get an item that is inside a closed container
 */
test("Test get from closed container", () => {
    builder.withObj({...NORTH_ROOM})
        .withObj({id : "chest",
                    name : "chest",
                    type : "item",
                    location : "northRoom",
                    desc : "A large chest",
                    tags : ["container", "closable"]
                    })
                .withObj({id : "ball",
                          name : "ball",
                          type : "item",
                          verbs : "throw",
                          location : "chest",
                          tags : ["carryable"],
    
                        })
                .withObj({id : "cube",
                          name : "cube",    
                          type : "item", 
                          location : "chest",
                          tags : ["carryable"]});

    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["get", "ball"], {});
    executeAndTest(["get", "cube"], {});
    executeAndTest(["put", "ball", "in", "chest"], {});
    executeAndTest(["put", "cube", "in", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "ball", "cube"]});
    executeAndTest(["close", "chest"], {});
    executeAndTest(["get", "ball"], { expected : ["the ball", "the chest is closed"]});
    executeAndTest(["get", "cube"], { expected : ["the cube", "the chest is closed"]});
    executeAndTest(["open", "chest"], {});
    executeAndTest(["get", "cube"], {});
    executeAndTest(["get", "ball"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest"], notExpected : ["ball", "cube"]});
});

/**
 * Test that you can't put an item into a closed container
 */
test("Test put into closed container", () => {
    builder.withObj({...NORTH_ROOM})
        .withObj({id : "chest",
                    name : "chest",
                    type : "item",
                    location : "northRoom",
                    desc : "A large chest",
                    tags : ["container", "openable"]
                    })
                .withObj({id : "ball",
                          name : "ball",
                          type : "item",
                          location : "northRoom",
                          tags : ["carryable"],
                        });

    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["get", "ball"], {});
    executeAndTest(["put", "ball", "in", "chest"], { expected : ["the chest is closed"]});
    executeAndTest(["open", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest"], notExpected : ["ball"]});
    executeAndTest(["put", "ball", "in", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "ball"]});
});

/**
 * Test that the presence of a closed container does not stop you getting an item not in the container
 */
test("Test can get item not in closed container", () => {
    builder.withObj({...NORTH_ROOM})
        .withObj({id : "chest",
                    name : "chest",
                    type : "item",
                    location : "northRoom",
                    desc : "A large chest",
                    tags : ["container", "openable", "carryable"]
                    })
                .withObj({id : "ball",
                          name : "ball",
                          type : "item",
                          location : "northRoom",
                          tags : ["carryable"],
                        });

    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["ball", "chest"]});
    executeAndTest(["get", "ball"], {});
    executeAndTest(["look"], { expected : ["chest"], notExpected : ["ball"]});
})

/**
 * Test that you can still get from a container you are holding
 */
test("Test get from container you are holding", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "backpack",
                        name : "backpack",
                        desc : "An old tattered backpack.",
                        type : "item",
                        location : "northRoom",
                        tags : ["container", "carryable"]
                        })
            .withObj({id : "ball",
                        name : "ball",
                        type : "item",
                        location : "backpack",
                        tags : ["carryable"]});
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["get", "ball"], {});
    executeAndTest(["get", "backpack"], {});
    executeAndTest(["put", "ball", "in", "backpack"], {});
    executeAndTest(["examine", "backpack"], { expected : ["backpack", "ball"]});
    executeAndTest(["get", "ball"], {});
});

/** 
 * Test you can't put a container in itself
 */
test("Test can't put container in itself", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "backpack",
                        name : "backpack",
                        desc : "An old tattered backpack.",
                        type : "item",
                        location : "northRoom",
                        tags : ["container", "carryable"]
                        })
            .withObj({id : "ball",
                        name : "ball",
                        type : "item",
                        location : "backpack",
                        tags : ["carryable"]});
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["get", "backpack"], {} );
    expectWords([], [], false, ["put"]);
    executeAndTest(["get", "ball"], {});
    expectWords([], ["put"], false);
    expectWords(["put"], ["ball"]);
});

/**
 * Test you can't indirectly put a container in itself
 */
test("Test can't put a container indirectly in itself", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "backpack",
                        name : "backpack",
                        desc : "An old tattered backpack.",
                        type : "item",
                        location : "northRoom",
                        tags : ["container", "carryable"]
                        })
            .withObj({id : "bag",
                        name : "bag",
                        type : "item",
                        location : "northRoom",
                        tags : ["container", "carryable"]});
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["get", "backpack"], {} );
    executeAndTest(["get", "bag"], {} );
    executeAndTest(["put", "bag", "in", "backpack"], {});
    executeAndTest(["put", "backpack", "in", "bag"], { expected : ["can't", "the bag is in the backpack"]});
});

test("Test put on container", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "table",
                        name : "table",
                        desc : "A large table.",
                        type : "item",
                        location : "northRoom",
                        relativeLocation : "on",
                        tags : ["container"]
                        })
            .withObj({id : "ball",
                        name : "ball",
                        type : "item",
                        location : "northRoom",
                        tags : ["carryable"]});
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["get", "ball"], {});
    expectWords(["put", "ball"], ["on"]);
    executeAndTest(["put", "ball", "on", "table"], {});
    executeAndTest(["examine", "table"], { expected : ["On the table", "ball"]});
});

test("Test invalid relativeLocation", () => {
    expect(() => {
        builder.withObj({...NORTH_ROOM})
               .withObj({id : "table",
                         name : "table",
                         desc : "A large table.",
                         type : "item",
                         location : "northRoom",
                         relativeLocation : "under",
                         tags : ["container"]
                        })
                    }).toThrow("Invalid relativeLocation");
});

test("Test overridden examine can still execute original method", () => { 
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "ball",
                      name : "ball",  
                      type : "item",
                      location : "northRoom",
                      tags : ["carryable"],
                    })
            .withObj({id : "bat",
                      name : "bat", 
                      type : "item",    
                      location : "chest",   
                      tags : ["carryable"]})
            .withObj({id : "chest",
                      name : "chest",
                      type : "item",
                      location : "northRoom",
                      desc : "A large chest", 
                      tags : ["container"],
                      after : {
                        "examine(this)" : {
                            when : "isAtLocation(bat, chest)",  // TODO should be isAtLocation(bat, this)
                            then : ["print('You examine the chest, inside is a bat')", "return(true)"],
                            otherwise : "return(false)"
                        }
                      }});
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["examine", "chest"], { expected : ["You examine the chest, inside is a bat"]});
    executeAndTest(["get", "bat"], {});
    executeAndTest(["inventory"], { expected : ["bat"]});
    executeAndTest(["examine", "chest"], { expected : ["A large chest"], notExpected: ["You examine the chest, inside is a bat"]});
    executeAndTest(["get", "ball"], {});
    executeAndTest(["put", "ball", "in", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "ball"]});
    executeAndTest(["put", "bat", "in", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["You examine the chest, inside is a bat"], notExpected : ["ball"]});
});

test("Test non-transparent closed container doesn't reveal contents", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "chest",
                        name : "chest",
                        type : "item",
                        location : "northRoom",
                        desc : "A large chest", 
                        tags : ["container", "openable"],
                        })
            .withObj({id : "ball",
                        name : "ball",  
                        type : "item",
                        location : "chest",
                        tags : ["carryable"],
                        });

    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["examine", "chest"], { expected : ["A large chest"], notExpected : ["ball"]});
    executeAndTest(["open", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "ball"]});
});

test("Test transparent closed container does reveal contents", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "chest",
                        name : "chest",
                        type : "item",
                        location : "northRoom",
                        desc : "A large chest", 
                        tags : ["container", "openable", "transparent"],
                        })
            .withObj({id : "ball",
                        name : "ball",  
                        type : "item",
                        location : "chest",
                        tags : ["carryable"],
                        });

    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["examine", "chest"], { expected : ["A large chest", "ball"]});
    executeAndTest(["open", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "ball"]});
});

/**
 * Test the isHoldable function returns true if the object is being carried,
 * but is not in a container
 */
test("Test isHolding", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "ball", 
                        name : "ball",
                        type : "item",
                        location : "northRoom",
                        tags : ["carryable"],
                        verbs : ["throw"],
                        before : { 
                            "throw(this)" : {
                                when : "isHolding(this)",
                                then : "print('You throw the ball')",
                                otherwise : "print('You are not holding the ball')" 
                            },
                        tags : ["carryable"]}})
            .withObj({id : "backpack",
                        name : "backpack",
                        desc : "An old tattered backpack.",
                        type : "item",
                        location : "northRoom",
                        tags : ["container", "carryable"]
                        })
            .withObj({id : "throw",
                        type : "verb",
                        tags : ["transitive"]});
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["throw", "ball"], { expected : ["You are not holding the ball"]});
    executeAndTest(["get", "ball"], {});
    executeAndTest(["throw", "ball"], { expected : ["You throw the ball"]});
    executeAndTest(["put", "ball", "in", "backpack"], {});
    executeAndTest(["throw", "ball"], { expected : ["You are not holding the ball"]});
});

test("Test isHolding as verb predicate", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "ball",
                        name : "ball",
                        type : "item",  
                        location : "northRoom",
                        tags : ["carryable"],
                        verbs : [{ 
                            "throw" : "isHolding(this)"
                        }]})
            .withObj({id : "backpack",
                        type : "item",
                        name : "backpack",
                        desc : "An old tattered backpack.",
                        location : "northRoom",
                        tags : ["container", "carryable"]
                    })
            .withObj({id : "throw",
                        type : "verb",
                        tags : ["transitive"]});
                        
    engine.ref = builder.build();
    engine.send(Input.start());

    expectWords([], ["get"], false, ["throw"]);
    executeAndTest(["get", "ball"], {});
    expectWords([], ["get", "throw"], false);
    executeAndTest(["get", "backpack"], {});
    executeAndTest(["put", "ball", "in", "backpack"], {});
    expectWords([], [], false, ["throw"]);
});

/**
 * Test the getName function returns the name of the object
 */
test("Test getName", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "ball",
                        name : "large ball",
                        type : "item",
                        location : "northRoom",
                        tags : ["carryable"],
                        before : {
                            "get(this)" : "print(getName(this) + ' is too heavy to lift')"
                        }});

    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["get", "ball"], { expected : ["large ball is too heavy to lift"]});
});

/**
 * Test the getFullName function returns the full name of the object
 */
test("Test getFullName", () => {
    builder.withObj({...NORTH_ROOM})
            .withObj({id : "ball",
                        name : "large ball",
                        type : "item",
                        location : "northRoom",
                        tags : ["carryable"],
                        before : {
                            "get(this)" : "print(getFullName(this) + ' is too heavy to lift')"
                        }});

    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["get", "ball"], { expected : ["the large ball is too heavy to lift"]});
});   

test("Test gameOver", () => {
    builder.withObj({...NORTH_ROOM})
           .withObj({id : "ball",
                     type : "item",
                     location : "northRoom",
                     tags : ["carryable"],
                     before : {
                        "get(this)" : [ "print('game over')", "gameOver()"]
                     }});
    engine.ref = builder.build();
    engine.send(Input.start());
    expectWords([], ["get", "look", "wait"], false);
    executeAndTest(["get", "ball"], { expected : ["game over"] });
    expectWords([], [], true);
});

test("Test can undo gameOver after instant action", () => {
    builder.withObj({
                ...NORTH_ROOM,
                desc : "The North Room",
                exits : { south : "southRoom" } })
           .withObj({
                ...SOUTH_ROOM,
                desc : "The South Room",
                exits : { north : "northRoom" } })
           .withObj({
                id : "message",
                type : "item",
                desc : "the message",
                location : "southRoom",
                before : {
                    "examine(this)" : [ "print('game over')", "gameOver()"]
                }
           });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["go", "south"], {});
    executeAndTest(["examine", "message"], { expected : [ "game over" ] });

    engine.send(Input.undo());
    executeAndTest(["look"], { expected : ["The South Room"]});
});

test("Test can undo gameOver after non-instant action", () => {
    builder.withObj({
                ...NORTH_ROOM,
                desc : "The North Room",
                exits : { south : "southRoom" } })
           .withObj({
                ...SOUTH_ROOM,
                desc : "The South Room",
                exits : { north : "northRoom" } })
           .withObj({
                id : "ball",
                type : "item",
                desc : "the ball",
                location : "southRoom",
                tags : ["carryable"],
                before : {
                    "get(this)" : [ "print('game over')", "gameOver()"]
                }
           });
    engine.ref = builder.build();
    engine.send(Input.start());
    executeAndTest(["go", "south"], {});
    executeAndTest(["get", "ball"], { expected : [ "game over" ] });

    engine.send(Input.undo());
    executeAndTest(["look"], { expected : ["The South Room"]});
});