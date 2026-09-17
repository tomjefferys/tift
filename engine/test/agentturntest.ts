import { ExecuteAndTestFn, createEngineTestEnvironment, EngineRef, findLogMessages } from "./testutils/testutils";
import { Input } from "../src/main";
import { GOBLIN } from "./testutils/testobjects";
import { EngineBuilder } from "../src/game/enginebuilder";
import { Log } from "tift-types/src/messages/output";

// Tests for the agent-scoped planning/execution primitives (Slice 3 of the NPC-agent work -
// see game/agent.ts): "executeCommandAs" (src/commandexecutor.ts#executeCommand, scoped to a
// named agent instead of whichever actor `env` already resolves to) and "createPlanFor"
// (src/commandplanner.ts#createPlan, ditto). Both let a game script drive an NPC exactly as
// if it were a player taking its own turn, without disturbing the player's own state.

let builder : EngineBuilder;
let engine : EngineRef;
let executeAndTest : ExecuteAndTestFn;
let messages : string[];
let log : Log[];

beforeEach(() => {
    const testEnvironment = createEngineTestEnvironment();
    engine = testEnvironment.engine;
    builder = testEnvironment.builder;
    executeAndTest = testEnvironment.executeAndTest;
    messages = testEnvironment.messages;
    log = testEnvironment.log;
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

test("Test createPlanFor's recursion guard is per-agent: blocks the same agent, allows another", () => {
    // A global rule's afterTurn() fires inside every command createPlanFor('goblin', ...)
    // itself simulates while searching (see examples/GoblinThief/src/npc/controller.yaml for
    // why authors are warned off this pattern). It calls createPlanFor again for two different
    // agents: 'goblin' (the one already being planned for - must be blocked) and 'orc' (a
    // different agent - must not be). 'orc' is planned for something already true, so its call
    // resolves at the initial state without expanding any commands of its own, and so never
    // itself risks recursing.
    builder.withObj({
        id : "roomA", type : "room", tags : ["start"], verbs : ["trigger"], exits : { east : "roomB" }
    });
    builder.withObj({ id : "roomB", type : "room", exits : { west : "roomA", east : "roomC" } });
    builder.withObj({ id : "roomC", type : "room", exits : { west : "roomB" } });
    builder.withObj({ ...GOBLIN, location : "roomB" });
    builder.withObj({ id : "orc", name : "an orc", type : "item", tags : ["NPC"], location : "roomB" });
    builder.withObj({
        id : "replanner", type : "rule",
        "afterTurn()" : [
            "createPlanFor('goblin', isAtLocation('goblin', 'roomC'), ['go'], 2)",
            "createPlanFor('orc', isAtLocation('orc', 'roomB'), ['go'], 2)"
        ]
    });
    withTriggerVerb([
        "plan = createPlanFor('goblin', isAtLocation('goblin', 'roomC'), ['go'], 2)",
        "print('plan:' + Array.join(Array.map(plan, fn([cmd], Array.join(cmd, ' '))), ';'))"
    ]);
    engine.ref = builder.build();
    engine.send(Input.start());

    engine.send(Input.execute(["trigger"]));

    const warnings = findLogMessages("warn", log);
    expect(warnings.some(message => message.includes("createPlan already running for 'goblin'"))).toBe(true);
    expect(warnings.some(message => message.includes("'orc'"))).toBe(false);
    expect(messages.join(' ')).toContain("plan:go east");
});

test("Test isPlanning and createPlanFor accept the agent entity itself, not just its id", () => {
    // Entities.getEntity already accepts either an id or the entity itself (see
    // game/agent.ts#resolveAgentId), so a function defined directly on the agent can pass
    // `this` instead of repeating its own id as a string literal.
    builder.withObj({ id : "roomA", type : "room", tags : ["start"], verbs : ["trigger"] });
    builder.withObj({
        ...GOBLIN, location : "roomA",
        "checkPlanning()" : "print('isPlanning(this):' + isPlanning(this))",
        "planForThis()" : [
            "plan = createPlanFor(this, isAtLocation('goblin', 'roomA'), ['go'], 2)",
            "print('planLength:' + Array.length(plan))"
        ]
    });
    withTriggerVerb([
        "goblin.checkPlanning()",
        "goblin.planForThis()"
    ]);
    engine.ref = builder.build();
    engine.send(Input.start());

    executeAndTest(["trigger"], {
        // Not currently planning when checkPlanning() runs; isAtLocation('goblin','roomA') is
        // already true, so createPlanFor(this, ...) finds a (trivial, zero-step) plan straight
        // away, proving `this` resolved to the goblin - not to eg the player or a missing agent.
        expected : ["isPlanning(this):false", "planLength:0"]
    });
});
