import { ExecuteAndTestFn, createEngineTestEnvironment, EngineRef } from "./testutils/testutils";
import { Input } from "../src/main";
import { THE_ROOM, ORDINARY_ITEM } from "./testutils/testobjects";
import { EngineBuilder } from "../src/game/enginebuilder";

// Tests for the "executeCommand" default function (backed by src/commandexecutor.ts),
// which lets game scripts (and eventually autonomous agents/NPCs) run a fully formed
// command programmatically, separately from the player's own turn.

let builder : EngineBuilder;
let engine : EngineRef;
let executeAndTest : ExecuteAndTestFn;

beforeEach(() => {
    const testEnvironment = createEngineTestEnvironment();
    engine = testEnvironment.engine;
    builder = testEnvironment.builder;
    executeAndTest = testEnvironment.executeAndTest;
});

test("Test executeCommand runs the matching action", () => {
    builder.withObj(THE_ROOM);
    builder.withObj(ORDINARY_ITEM);
    builder.withObj({
        id : "grabber",
        type : "rule",
        "afterTurn()" : "executeCommand(['get', 'anItem'])"
    });
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["look"], { expected : ["an ordinary item"]});

    // "wait" triggers the afterTurn rule, which runs executeCommand to get the item
    executeAndTest(["wait"], {});
    executeAndTest(["look"], { notExpected : ["an ordinary item"]});
});

test("Test executeCommand returns false and does nothing for an unmatched command", () => {
    builder.withObj(THE_ROOM);
    builder.withObj(ORDINARY_ITEM);
    builder.withObj({
        id : "grabber",
        type : "rule",
        "afterTurn()" : "print(if(executeCommand(['get', 'nonexistent'])).then('matched').else('not matched'))"
    });
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["wait"], { expected : ["not matched"]});
    executeAndTest(["look"], { expected : ["an ordinary item"]});
});

test("Test executeCommand with full=true also runs before/after turn rules", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "ball",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });
    builder.withObj({
        id : "turnRule",
        type : "rule",
        "beforeTurn()" : "print('turn-before')",
        "afterTurn()" : "print('turn-after')"
    });
    builder.withObj({
        id : "button",
        type : "item",
        location : "theRoom",
        verbs : ["examine"],
        before : {
            // "examine" is instant, so the outer command won't itself trigger the
            // engine's before/after-turn rules - any rule output must have come
            // from the nested executeCommand call.
            "examine(this)" : "executeCommand(['get', 'ball'], true)"
        }
    });
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["examine", "button"], { expected : ["turn-before", "turn-after"]});
    executeAndTest(["look"], { notExpected : ["ball"]});
});

test("Test executeCommand defaults to full=false and skips before/after turn rules", () => {
    builder.withObj(THE_ROOM);
    builder.withObj({
        id : "ball",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });
    builder.withObj({
        id : "turnRule",
        type : "rule",
        "beforeTurn()" : "print('turn-before')",
        "afterTurn()" : "print('turn-after')"
    });
    builder.withObj({
        id : "button",
        type : "item",
        location : "theRoom",
        verbs : ["examine"],
        before : {
            "examine(this)" : "executeCommand(['get', 'ball'])"
        }
    });
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["examine", "button"], { notExpected : ["turn-before", "turn-after"]});
    // The action itself still ran, even without the rule phases
    executeAndTest(["look"], { notExpected : ["ball"]});
});
