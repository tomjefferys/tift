import { ExecuteAndTestFn, createEngineTestEnvironment, EngineRef } from "./testutils/testutils";
import { Input } from "../src/main";
import { THE_ROOM, ORDINARY_ITEM, GAME_METADATA } from "./testutils/testobjects";
import { EngineBuilder } from "../src/game/enginebuilder";

// Tests for the "createPlan" default function (backed by src/commandplanner.ts), which
// searches (depth first) for a sequence of commands that makes a predicate true, simulating
// each candidate command against an override-proxied fork of the state (see
// src/env.ts#ForkManager) so the real game is never touched while searching.

let builder : EngineBuilder;
let engine : EngineRef;
let executeAndTest : ExecuteAndTestFn;

beforeEach(() => {
    const testEnvironment = createEngineTestEnvironment();
    engine = testEnvironment.engine;
    builder = testEnvironment.builder;
    executeAndTest = testEnvironment.executeAndTest;
});

// A zero-arg verb, added to whichever room needs it, that runs createPlan and prints the
// result. This is a self contained way to invoke createPlan from the DSL - notably it never
// appears in any test's own verbList, so the search can never recurse into triggering itself.
function withTriggerVerb(createPlanExpr : string) {
    builder.withObj({
        id : "trigger",
        type : "verb",
        tags : ["intransitive"],
        actions : {
            "trigger()" : [
                `plan = ${createPlanExpr}`,
                "print('planLength:' + Array.length(plan))",
                "print('plan:' + Array.join(Array.map(plan, fn([cmd], Array.join(cmd, ' '))), ';'))"
            ]
        }
    });
}

test("Test createPlan finds a plan for a simple goal", () => {
    builder.withObj({...THE_ROOM, verbs : ["trigger"]});
    builder.withObj(ORDINARY_ITEM);
    withTriggerVerb("createPlan(isCarrying(anItem), ['get'], 4)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["planLength:1", "plan:get anItem"] });

    // The search must not have actually changed anything in the real game
    executeAndTest(["look"], { expected : ["an ordinary item"] });
});

test("Test createPlan returns an empty plan when depth is 0", () => {
    builder.withObj({...THE_ROOM, verbs : ["trigger"]});
    builder.withObj(ORDINARY_ITEM);
    withTriggerVerb("createPlan(isCarrying(anItem), ['get'], 0)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["planLength:0"] });
});

test("Test createPlan respects the depth limit", () => {
    builder.withObj({
        id : "start", type : "room", tags : ["start"], verbs : ["trigger"],
        exits : { north : "north" }
    });
    builder.withObj({ id : "north", type : "room", exits : { south : "start" } });
    builder.withObj({ id : "prize", name : "the prize", type : "item", location : "north", tags : ["carryable"] });
    // Reaching the prize needs 2 steps (go north, get prize) - depth 1 isn't enough.
    withTriggerVerb("createPlan(isCarrying(prize), ['go', 'get'], 1)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["planLength:0"] });
});

test("Test createPlan finds a multi-step plan, without mutating the real game", () => {
    builder.withObj({
        id : "start", type : "room", tags : ["start"], verbs : ["trigger"],
        exits : { north : "north" }
    });
    builder.withObj({ id : "north", type : "room", exits : { south : "start" } });
    builder.withObj({ id : "prize", name : "the prize", type : "item", location : "north", tags : ["carryable"] });
    withTriggerVerb("createPlan(isCarrying(prize), ['go', 'get'], 2)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["planLength:2", "plan:go north;get prize"] });

    // Confirm the search really was simulated, not actually performed: the player hasn't
    // moved, and the prize is still where it started.
    executeAndTest(["go", "north"], {});
    executeAndTest(["look"], { expected : ["the prize"] });
});

test("Test createPlan prunes cyclic states instead of exhausting the search space", () => {
    // A triangle of rooms, each with 2 exits, so every step has branching factor 2 and there
    // are countless ways to wander in circles between them.
    builder.withObj({
        id : "roomA", type : "room", tags : ["start"], verbs : ["trigger"],
        exits : { east : "roomB", west : "roomC" }
    });
    builder.withObj({ id : "roomB", type : "room", exits : { east : "roomC", west : "roomA" } });
    builder.withObj({ id : "roomC", type : "room", exits : { east : "roomA", west : "roomB" } });

    // The goal is unreachable, so the search will try to exhaust every path up to depth 24.
    // Without loop detection (see commandplanner.ts#stateKey) that's up to 2^24 paths to
    // explore before giving up; with it, there are only 3 distinct states to ever visit, so
    // this should resolve near instantly. If loop detection regresses, this test times out.
    withTriggerVerb("createPlan(getScore() == 999, ['go'], 24)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["planLength:0"] });
}, 5000);

test("Test createPlan's ignoredProperties keeps loop detection working despite a per-turn counter", () => {
    builder.withObj({...GAME_METADATA, ignoredProperties : ["entities.counter"]});
    builder.withObj({
        id : "roomA", type : "room", tags : ["start"], verbs : ["trigger"],
        exits : { east : "roomB", west : "roomC" }
    });
    builder.withObj({ id : "roomB", type : "room", exits : { east : "roomC", west : "roomA" } });
    builder.withObj({ id : "roomC", type : "room", exits : { east : "roomA", west : "roomB" } });
    // A rule that mutates state on every turn, the way a turn counter or clock would. Left
    // untouched by ignoredProperties, this would make every simulated state look distinct
    // (since the counter always differs), defeating loop detection entirely.
    builder.withObj({
        id : "counter", type : "rule", turns : 0,
        "afterTurn()" : "counter.turns = counter.turns + 1"
    });

    withTriggerVerb("createPlan(getScore() == 999, ['go'], 24)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["planLength:0"] });
}, 5000);
