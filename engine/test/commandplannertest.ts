import { ExecuteAndTestFn, createEngineTestEnvironment, EngineRef } from "./testutils/testutils";
import { Input } from "../src/main";
import { THE_ROOM, ORDINARY_ITEM, GAME_METADATA } from "./testutils/testobjects";
import { EngineBuilder } from "../src/game/enginebuilder";
import { createRootEnv } from "../src/env";
import { EnvFn, mkResult } from "../src/script/thunk";
import { createPlan } from "../src/commandplanner";
import { EntityBuilder } from "../src/game/entitybuilder";
import * as Player from "../src/game/player";
import * as Agent from "../src/game/agent";
import { Obj } from "tift-types/src/util/objects";

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

test("Test createPlan does not leak writes into the real game via a nested sub-object function", () => {
    // A function defined on a nested sub-object (as opposed to directly on the entity) used to
    // close over a fixed, real object reference captured at compile time - so calling it during
    // a createPlan search would read stale state and leak its writes into the real game, even
    // though the search is only supposed to touch forked/simulated state (see
    // game/functionbuilder.ts#makeDynamicScope).
    builder.withObj({
        ...THE_ROOM,
        verbs : ["trigger", "poke", "check"],
        counter : {
            count : 0,
            "bump()" : "count = count + 1"
        }
    });
    builder.withObj({
        id : "poke", type : "verb", tags : ["intransitive"],
        actions : { "poke()" : "theRoom.counter.bump()" }
    });
    builder.withObj({
        id : "check", type : "verb", tags : ["intransitive"],
        actions : { "check()" : "print('count:' + theRoom.counter.count)" }
    });
    withTriggerVerb("createPlan(theRoom.counter.count == 1, ['poke'], 2)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["planLength:1", "plan:poke"] });

    // The search's simulated poke()->bump() calls must not have touched the real counter.
    executeAndTest(["check"], { expected : ["count:0"] });
});

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

test("Test createPlan survives a rule that calls it again from afterTurn during the search", () => {
    // Reproduces the exact trap examples/GoblinThief/src/npc/controller.yaml warns authors
    // away from: a global rule's afterTurn() calls createPlan, but afterTurn() also fires
    // inside every command the search itself simulates (full=true - see run()), so without a
    // guard this rule would call createPlan again for every node visited, which would start
    // another search that hits the same rule again, without end. The nested call here is for
    // the same (default, player) actor as the outer one, so it should be blocked rather than
    // recursing - the outer plan must still be found normally.
    builder.withObj({
        id : "start", type : "room", tags : ["start"], verbs : ["trigger"],
        exits : { north : "north" }
    });
    builder.withObj({ id : "north", type : "room", exits : { south : "start" } });
    builder.withObj({ id : "prize", name : "the prize", type : "item", location : "north", tags : ["carryable"] });
    builder.withObj({
        id : "replanner", type : "rule",
        "afterTurn()" : "createPlan(isCarrying(prize), ['get'], 1)"
    });
    withTriggerVerb("createPlan(isCarrying(prize), ['go', 'get'], 2)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], {
        expected : ["planLength:2", "plan:go north;get prize"],
        errors : ["createPlan already running for '__PLAYER__'"]
    });
}, 5000);

test("Test isPlanning lets a rule check for itself, instead of relying on createPlan's own guard", () => {
    // Same scenario as the test above, but the rule uses the recommended pattern - checking
    // isPlanning() before calling createPlan - rather than relying on the engine's guard as a
    // backstop. If isPlanning() didn't correctly report true for the duration of the search it's
    // checking, the rule would call createPlan anyway and this test would instead see the
    // guard's warning fire (as the test above does).
    builder.withObj({
        id : "start", type : "room", tags : ["start"], verbs : ["trigger"],
        exits : { north : "north" }
    });
    builder.withObj({ id : "north", type : "room", exits : { south : "start" } });
    builder.withObj({ id : "prize", name : "the prize", type : "item", location : "north", tags : ["carryable"] });
    builder.withObj({
        id : "replanner", type : "rule",
        "afterTurn()" : "if(!isPlanning()).then(createPlan(isCarrying(prize), ['get'], 1))"
    });
    withTriggerVerb("createPlan(isCarrying(prize), ['go', 'get'], 2)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["planLength:2", "plan:go north;get prize"] });
}, 5000);

test("Test createPlan's recursion guard is released after a normal search completes", () => {
    // If the guard's cleanup didn't run, the first search would leave the player's id
    // permanently marked "in progress", and this second, unrelated call would be incorrectly
    // blocked too.
    builder.withObj({...THE_ROOM, verbs : ["trigger"]});
    builder.withObj(ORDINARY_ITEM);
    withTriggerVerb("createPlan(isCarrying(anItem), ['get'], 4)");
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["planLength:1", "plan:get anItem"] });
    executeAndTest(["trigger"], { expected : ["planLength:1", "plan:get anItem"] });
});

// A minimal raw env (no DSL/engine layer) with just enough set up to resolve the default
// (player) actor - mirrors agenttest.ts's makeEnv(). Used below where the DSL/engine layer would
// get in the way (see the throw test's comment for why).
function makePlanningTestEnv() : ReturnType<typeof createRootEnv> {
    const props : Obj = { entities : {}, verbs : {} };
    const env = createRootEnv(props, [["entities"], ["verbs"]]);
    Player.makePlayer(env, "theRoom");
    Agent.makeAgentContainers(env, Player.PLAYER);
    props.entities["theRoom"] = new EntityBuilder({ id : "theRoom", type : "room" }).build();
    return env;
}

test("Test createPlan's recursion guard is released even if the search throws", () => {
    // Unit-level rather than DSL-level: BasicEngine.send() catches any error a command throws
    // and puts the engine into a permanent error state (further Execute messages become
    // no-ops - see engine.ts#send), which would make it impossible to observe whether a
    // *second*, independent call still works. Calling createPlan directly sidesteps that and
    // isolates exactly what's under test - that the guard's cleanup runs via `finally`, not
    // only on the successful-return path.
    const env = makePlanningTestEnv();
    const throwingPredicate : EnvFn = () => { throw new Error("boom"); };
    expect(() => createPlan(env, throwingPredicate, [], 1)).toThrow("boom");

    // The guard is the player's own Agent.PLANNING property - if the failed call above hadn't
    // cleared it, this would still read true.
    expect(Agent.isPlanning(env, Player.PLAYER)).toBe(false);

    // A predicate that's already true at the initial state - if the guard were still (wrongly)
    // marking the player as "in progress" from the failed call above, this would come back
    // `undefined` (blocked) instead of `[]` (satisfied with zero steps).
    const truePredicate : EnvFn = () => mkResult(true);
    const plan = createPlan(env, truePredicate, [], 1);
    expect(plan).toEqual([]);
});

test("Test createPlan exposes Agent.PLANNING on the agent's own entity for the duration of the search", () => {
    // The guard (see createPlan) is deliberately just an ordinary property on the agent's own
    // entity, not hidden engine state - so it's something a game script can read too (via the
    // "isPlanning" stdlib function - see the DSL-level tests above), eg to skip its own work
    // while a search for that agent is already under way. Prove it's genuinely readable via a
    // plain property access on the actor's entity, not via the internal Agent.isPlanning helper.
    const env = makePlanningTestEnv();
    let observedWhilePlanning : unknown;
    const predicate : EnvFn = probeEnv => {
        observedWhilePlanning = Agent.getActor(probeEnv, Player.PLAYER)[Agent.PLANNING];
        return mkResult(false);
    };

    expect(Agent.getActor(env, Player.PLAYER)[Agent.PLANNING]).toBeFalsy();
    createPlan(env, predicate, [], 0);

    expect(observedWhilePlanning).toBe(true);
    expect(Agent.getActor(env, Player.PLAYER)[Agent.PLANNING]).toBeFalsy();
});
