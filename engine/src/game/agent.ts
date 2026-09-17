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

// `agent` accepts either an agent's id or the agent entity itself - Entities.getEntity already
// handles both - so script-facing functions (eg isPlanning) can accept `this` as well as a
// plain id string, without needing to know or care which was given.
export function getActor(env : Env, agent : unknown = getActorId(env)) : Entity {
    return Entities.getEntity(env, agent) as Entity;
}

/**
 * Resolves `agent` - an agent's id, or the agent entity itself - down to its id. Needed by
 * callers (eg createPlanFor - see enginedefault.ts) that must hand a plain string on to
 * something that only deals in ids (eg commandplanner.ts#createPlan's actorId, which gets used
 * to derive other ids and can't itself be an entity) - getActor/isPlanning/setPlanning don't
 * need this since they resolve straight to the entity via Entities.getEntity and never need the
 * id in isolation.
 */
export function resolveAgentId(env : Env, agent : unknown) : string {
    return Entities.getEntity(env, agent).id as string;
}

// Whether a plan search (createPlan/createPlanFor - see commandplanner.ts) is currently running
// for this agent. Deliberately an ordinary property on the agent's own entity, not
// engine-internal bookkeeping - so it's visible, checkable game state: a rule can check it via
// the "isPlanning" stdlib function (see enginedefault.ts) - eg to skip its own work while a
// search for that agent is already underway, or narrate "the goblin pauses, thinking" - and
// commandplanner.ts#createPlan reads and writes the same property to guard against recursing
// into itself for the same agent (a search simulates full turns, including
// beforeTurn()/afterTurn() rules, so a rule that replans from afterTurn() also fires *inside*
// every command the search itself simulates). Double-underscored, matching this file's other
// engine-managed property (ACTOR, above), so it doesn't collide with a game author's own
// same-named entity property.
//
// Storing this in game state, given createPlan simulates by forking (env.ts#ForkManager), might
// look like it risks corrupting loop detection (commandplanner.ts#stateKey diffs "touched"
// state against the search's starting point) - it doesn't. Every write here is set immediately
// before a search starts and cleared (via try/finally) immediately after it ends, synchronously
// and always in matching pairs - so by the time any candidate command's touched paths are
// captured (right after that command's simulation finishes), this property's value is already
// back to what it was at the start of that step, identical to the state stateKey diffs against.
export const PLANNING = "__planning__";

export function isPlanning(env : Env, agent : unknown = getActorId(env)) : boolean {
    return Boolean(getActor(env, agent)[PLANNING]);
}

export function setPlanning(env : Env, agent : unknown, planning : boolean) : void {
    getActor(env, agent)[PLANNING] = planning;
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
