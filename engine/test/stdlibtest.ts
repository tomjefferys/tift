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
