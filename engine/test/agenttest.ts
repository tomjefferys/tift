import { createRootEnv } from "../src/env";
import { Obj } from "tift-types/src/util/objects";
import { EntityBuilder } from "../src/game/entitybuilder";
import * as Agent from "../src/game/agent";
import * as Player from "../src/game/player";
import { getContext } from "../src/game/context";
import * as MultiDict from "../src/util/multidict";

// Tests for game/agent.ts, the "current actor" abstraction that generalises the
// player. This is a pure refactor (see the "createPlan"/executeCommand NPC work):
// with no actor bound, everything here must behave exactly as the old
// player-only code did. Slice 3 will add ways to actually bind a non-player
// actor to a real turn; here we're only proving the plumbing is sound and that
// getContext's actorId parameter resolves scope correctly for either actor.

function makeEnv() {
    const props : Obj = { entities : {}, verbs : {} };
    // Namespaces mirror the real engine's root env (see BASE_NS in engine.ts) -
    // findObjs/getEntity resolve entities via the "entities" namespace.
    const env = createRootEnv(props, [["entities"], ["verbs"]]);
    Player.makePlayer(env, "theRoom");
    props.entities["theRoom"] = new EntityBuilder({ id : "theRoom", type : "room" }).build();
    return env;
}

function idsOf(entities : Obj[]) : string[] {
    return entities.map(entity => entity.id).sort();
}

test("Test getActorId defaults to the player when no actor is bound", () => {
    const env = makeEnv();
    expect(Agent.getActorId(env)).toEqual(Player.PLAYER);
});

test("Test withActor binds a different actor without affecting the parent env", () => {
    const env = makeEnv();
    env.properties.entities["npc1"] = new EntityBuilder({ id : "npc1", type : "item", location : "theRoom" }).build();

    const npcEnv = Agent.withActor(env, "npc1");

    expect(Agent.getActorId(npcEnv)).toEqual("npc1");
    expect(Agent.getActorId(env)).toEqual(Player.PLAYER);
});

test("Test getActor/getLocation/getLocationEntity resolve the bound actor", () => {
    const env = makeEnv();
    props(env).entities["otherRoom"] = new EntityBuilder({ id : "otherRoom", type : "room" }).build();
    props(env).entities["npc1"] = new EntityBuilder({ id : "npc1", type : "item", location : "otherRoom" }).build();

    expect(Agent.getActor(env).id).toEqual(Player.PLAYER);
    expect(Agent.getLocation(env)).toEqual("theRoom");
    expect(Agent.getLocationEntity(env).id).toEqual("theRoom");

    const npcEnv = Agent.withActor(env, "npc1");
    expect(Agent.getActor(npcEnv).id).toEqual("npc1");
    expect(Agent.getLocation(npcEnv)).toEqual("otherRoom");
    expect(Agent.getLocationEntity(npcEnv).id).toEqual("otherRoom");
});

test("Test getInventoryId/getWearingId derive the player's containers the same way as any other agent", () => {
    const env = makeEnv();

    expect(Agent.getInventoryId(env)).toEqual(Player.INVENTORY);
    expect(Agent.getWearingId(env)).toEqual(Player.WEARING);
});

test("Test getInventoryId/getWearingId derive a <agentId>-INVENTORY/-WEARING id for any other actor, with nothing to configure", () => {
    const env = makeEnv();
    props(env).entities["npc1"] = new EntityBuilder({ id : "npc1", type : "item", location : "theRoom" }).build();

    const npcEnv = Agent.withActor(env, "npc1");
    expect(Agent.getInventoryId(npcEnv)).toEqual("npc1-INVENTORY");
    expect(Agent.getWearingId(npcEnv)).toEqual("npc1-WEARING");

    // Also resolvable from an unrelated env by passing the actorId straight through
    // (eg the command planner, simulating against a forked env with no actor bound).
    expect(Agent.getInventoryId(env, "npc1")).toEqual("npc1-INVENTORY");
    expect(Agent.getWearingId(env, "npc1")).toEqual("npc1-WEARING");
});

test("Test getContext scope is unchanged for the player (parity with the pre-actor-refactor behaviour)", () => {
    const env = makeEnv();
    const entities = props(env).entities;

    entities["envItem"] = new EntityBuilder({ id : "envItem", type : "item", location : "theRoom" }).build();
    entities["carriedItem"] = new EntityBuilder({ id : "carriedItem", type : "item", location : Player.INVENTORY }).build();
    entities["wornItem"] = new EntityBuilder({ id : "wornItem", type : "item", location : Player.WEARING }).build();
    entities["box"] = new EntityBuilder({ id : "box", type : "item", location : "theRoom", tags : ["container"] }).build();
    entities["boxItem"] = new EntityBuilder({ id : "boxItem", type : "item", location : "box" }).build();

    const context = getContext(env);

    expect(idsOf(MultiDict.get(context.entities, "location"))).toEqual(["theRoom"]);
    // "environment" is "local and not carried by the actor" - it isn't exclusive
    // of "container", and includes the actor's own entity (which is local to its
    // own location and not, by this definition, "carried" by itself). Both are
    // pre-existing quirks this refactor deliberately preserves rather than fixes.
    expect(idsOf(MultiDict.get(context.entities, "environment"))).toEqual(["__PLAYER__", "box", "boxItem", "envItem"]);
    expect(idsOf(MultiDict.get(context.entities, "inventory"))).toEqual(["carriedItem"]);
    expect(idsOf(MultiDict.get(context.entities, "wearing"))).toEqual(["wornItem"]);
    expect(idsOf(MultiDict.get(context.entities, "container"))).toEqual(["boxItem"]);
});

test("Test getContext resolves scope for an explicit non-player actorId", () => {
    const env = makeEnv();
    const entities = props(env).entities;

    entities["otherRoom"] = new EntityBuilder({ id : "otherRoom", type : "room" }).build();
    // No "inventory"/"wearing" props needed anywhere - the container ids are
    // derived from npc1's own id by convention (see Agent.getInventoryId).
    entities["npc1-INVENTORY"] = new EntityBuilder({ id : "npc1-INVENTORY", type : "special", location : "npc1", tags : ["container"] }).build();
    entities["npc1-WEARING"] = new EntityBuilder({ id : "npc1-WEARING", type : "special", location : "npc1", tags : ["container"] }).build();
    entities["npc1"] = new EntityBuilder({ id : "npc1", type : "item", location : "otherRoom" }).build();
    entities["npcItem"] = new EntityBuilder({ id : "npcItem", type : "item", location : "otherRoom" }).build();
    entities["npcCarried"] = new EntityBuilder({ id : "npcCarried", type : "item", location : "npc1-INVENTORY" }).build();

    // A player-side item, to prove the npc's context doesn't leak the player's scope
    entities["playerItem"] = new EntityBuilder({ id : "playerItem", type : "item", location : "theRoom" }).build();

    const npcContext = getContext(env, "npc1");

    expect(idsOf(MultiDict.get(npcContext.entities, "location"))).toEqual(["otherRoom"]);
    // Includes npc1 itself, for the same reason the player shows up in its own
    // "environment" bucket - see the parity test above.
    expect(idsOf(MultiDict.get(npcContext.entities, "environment"))).toEqual(["npc1", "npcItem"]);
    expect(idsOf(MultiDict.get(npcContext.entities, "inventory"))).toEqual(["npcCarried"]);
    expect(idsOf(MultiDict.get(npcContext.entities, "wearing"))).toEqual([]);

    // The player's own (default) context is unaffected by the npc existing
    const playerContext = getContext(env);
    expect(idsOf(MultiDict.get(playerContext.entities, "location"))).toEqual(["theRoom"]);
    expect(idsOf(MultiDict.get(playerContext.entities, "environment"))).toEqual(["__PLAYER__", "playerItem"]);
});

function props(env : ReturnType<typeof createRootEnv>) : Obj {
    return env.properties;
}
