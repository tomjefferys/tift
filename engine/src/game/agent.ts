import { Env } from "tift-types/src/env";
import { Obj } from "tift-types/src/util/objects";
import { Entity } from "../entity";
import { EntityBuilder } from "./entitybuilder";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Player from "./player";
import * as Tags from "./tags";

/**
 * "Agent" generalises the player to any entity that can act: perform commands,
 * have a location, carry/wear items. The player is just the default agent -
 * unless a command is being run on behalf of some other entity (eg an NPC, via
 * withActor()), "the current actor" is the player, exactly as before this
 * abstraction existed.
 *
 * Every function here takes an optional explicit `actorId`, defaulting to
 * getActorId(env). This lets code that already has an env with the actor bound
 * (the common case) call these with just an env, while code that's resolving a
 * different agent's scope from an unrelated env (eg the command planner,
 * simulating against a forked env that has no actor binding of its own) can pass
 * the id straight through.
 */

// Env binding holding the id of the entity currently acting. Unset for the
// player's own turn, in which case getActorId() falls back to the player.
const ACTOR = "__actor__";

/**
 * A child env with `actorId` bound as the current actor, for running or
 * simulating a command on behalf of an agent other than the player.
 */
export function withActor(env : Env, actorId : string) : Env {
    return env.newChild({ [ACTOR] : actorId });
}

export function getActorId(env : Env) : string {
    return env.has(ACTOR) ? env.get(ACTOR) as string : Player.PLAYER;
}

export function getActor(env : Env, actorId : string = getActorId(env)) : Entity {
    return Entities.getEntity(env, actorId) as Entity;
}

export function getLocation(env : Env, actorId? : string) : string {
    return Locations.getLocation(getActor(env, actorId));
}

export function getLocationEntity(env : Env, actorId? : string) : Obj {
    return Entities.getEntity(env, getLocation(env, actorId));
}

// The ids of the special containers holding the items an agent is carrying/
// wearing. These are derived by convention from the agent's id ("<agentId>-
// INVENTORY"/"-WEARING") rather than recorded as bookkeeping on the agent
// entity - every agent (the player included - see Player.INVENTORY/WEARING)
// gets one "for free", with nothing to keep in sync. A container's own
// "location" prop (pointing back at the agent) remains the single source of
// truth for who it belongs to.
export function getInventoryId(env : Env, actorId : string = getActorId(env)) : string {
    return `${actorId}-INVENTORY`;
}

export function getWearingId(env : Env, actorId : string = getActorId(env)) : string {
    return `${actorId}-WEARING`;
}

/**
 * Create the special inventory/wearing container entities for `agentId` (see
 * getInventoryId/getWearingId), registering them directly into the env. Called
 * once per agent when the game starts (see game/behaviour.ts) - for the player
 * and for every other agent-tagged entity loaded from the game data.
 */
export function makeAgentContainers(env : Env, agentId : string) : void {
    const props = env.properties;
    [getInventoryId(env, agentId), getWearingId(env, agentId)].forEach(containerId => {
        props["entities"][containerId] = new EntityBuilder({
            id : containerId,
            type : Entities.Types.SPECIAL,
            location : agentId
        }).withTag(Tags.CONTAINER).build();
    });
}
