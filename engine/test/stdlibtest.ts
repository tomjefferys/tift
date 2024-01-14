import { EngineBuilder } from "../src/builder/enginebuilder";
import { SaveData, ExecuteAndTestFn, ExpectWordsFn, createEngineTestEnvironment, EngineRef } from "./testutils/testutils";
import { Input } from "../src/main";
import { THE_ROOM, NORTH_ROOM } from "./testutils/testobjects";

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
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "ball"], notExpected : ["cube"]});
    executeAndTest(["put", "cube", "in", "chest"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "ball", "cube"]});
    executeAndTest(["get", "ball"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest", "cube"], notExpected : ["ball"]});
    executeAndTest(["get", "cube"], {});
    executeAndTest(["examine", "chest"], { expected : ["A large chest"], notExpected : ["ball", "cube"]});
})

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