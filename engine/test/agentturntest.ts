import { ExecuteAndTestFn, createEngineTestEnvironment, EngineRef } from "./testutils/testutils";
import { Input } from "../src/main";
import { GOBLIN } from "./testutils/testobjects";
import { EngineBuilder } from "../src/game/enginebuilder";

// Tests for the agent-scoped planning/execution primitives (Slice 3 of the NPC-agent work -
// see game/agent.ts): "executeCommandAs" (src/commandexecutor.ts#executeCommand, scoped to a
// named agent instead of whichever actor `env` already resolves to) and "createPlanFor"
// (src/commandplanner.ts#createPlan, ditto). Both let a game script drive an NPC exactly as
// if it were a player taking its own turn, without disturbing the player's own state.

let builder : EngineBuilder;
let engine : EngineRef;
let executeAndTest : ExecuteAndTestFn;

beforeEach(() => {
    const testEnvironment = createEngineTestEnvironment();
    engine = testEnvironment.engine;
    builder = testEnvironment.builder;
    executeAndTest = testEnvironment.executeAndTest;
});

// A zero-arg verb, added to whichever room needs it, that runs the given action lines - a
// self contained way to invoke executeCommandAs/createPlanFor from the DSL.
function withTriggerVerb(actions : string[]) {
    builder.withObj({
        id : "trigger",
        type : "verb",
        tags : ["intransitive"],
        actions : {
            "trigger()" : actions
        }
    });
}

test("Test executeCommandAs moves the named agent, leaving the player where it was", () => {
    builder.withObj({ id : "roomA", type : "room", tags : ["start"], verbs : ["trigger"], exits : { south : "roomB" } });
    builder.withObj({ id : "roomB", type : "room", exits : { north : "roomA" } });
    builder.withObj({ ...GOBLIN, location : "roomA" });
    withTriggerVerb([
        "executeCommandAs('goblin', ['go', 'south'])",
        "print('goblinInRoomB:' + isAtLocation('goblin', 'roomB'))",
        "print('playerInRoomA:' + isAtLocation('__PLAYER__', 'roomA'))"
    ]);
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["goblinInRoomB:true", "playerInRoomA:true"] });
});

test("Test executeCommandAs picks up an item for the named agent, not the player", () => {
    builder.withObj({ id : "roomA", type : "room", tags : ["start"], verbs : ["trigger"] });
    builder.withObj({ ...GOBLIN, location : "roomA" });
    builder.withObj({ id : "sword", name : "a sword", type : "item", location : "roomA", tags : ["carryable"] });
    withTriggerVerb([
        "executeCommandAs('goblin', ['get', 'sword'])",
        "print('goblinHasSword:' + isAtLocation('sword', 'goblin'))",
        "print('playerHasSword:' + isAtLocation('sword', '__PLAYER__'))"
    ]);
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["goblinHasSword:true", "playerHasSword:false"] });
});

test("Test createPlanFor searches from the named agent's own location, not the player's", () => {
    // The player starts in roomA, which has no exits at all - if createPlanFor mistakenly
    // searched from the player's own context, no "go" command would even be available and
    // the plan would come back empty. The goblin starts in roomB, from which the goal room
    // roomC *is* reachable - so a non-empty plan here proves the search really used the
    // goblin's own viewpoint.
    builder.withObj({ id : "roomA", type : "room", tags : ["start"], verbs : ["trigger"] });
    builder.withObj({ id : "roomB", type : "room", exits : { south : "roomC" } });
    builder.withObj({ id : "roomC", type : "room", exits : { north : "roomB" } });
    builder.withObj({ ...GOBLIN, location : "roomB" });
    withTriggerVerb([
        "plan = createPlanFor('goblin', isAtLocation('goblin', 'roomC'), ['go'], 4)",
        "print('plan:' + Array.join(Array.map(plan, fn([cmd], Array.join(cmd, ' '))), ';'))"
    ]);
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], { expected : ["plan:go south"] });
});

test("Test createPlanFor does not mutate the real game while searching", () => {
    builder.withObj({ id : "roomA", type : "room", tags : ["start"], verbs : ["trigger"] });
    builder.withObj({ ...GOBLIN, location : "roomA" });
    builder.withObj({ id : "sword", name : "a sword", type : "item", location : "roomA", tags : ["carryable"] });
    withTriggerVerb([
        "plan = createPlanFor('goblin', isAtLocation('sword', 'goblin'), ['get'], 2)",
        "print('plan:' + Array.join(Array.map(plan, fn([cmd], Array.join(cmd, ' '))), ';'))",
        "print('stillLoose:' + isAtLocation('sword', 'roomA'))",
        "print('goblinEmptyHanded:' + isAtLocation('sword', 'goblin'))"
    ]);
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], {
        expected : ["plan:get sword", "stillLoose:true", "goblinEmptyHanded:false"]
    });
});
