import { EntityBuilder } from "./entitybuilder";
import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";
import { Entity } from "../entity";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Tags from "./tags";

export const PLAYER = "__PLAYER__";
// The player is just an agent (see game/agent.ts) - its inventory/wearing
// containers follow the same "<agentId>-INVENTORY"/"-WEARING" naming convention
// as any other agent's.
export const INVENTORY = `${PLAYER}-INVENTORY`;
export const WEARING = `${PLAYER}-WEARING`;

export function makePlayer(env : Env, start : string) {

    const props = env.properties;

    const player = new EntityBuilder({
        id : PLAYER,
        type : "player",
        location : start,
        score : 0,
        visitedLocations : {}
    }).withVerb("inventory")
      .withVerb("wait")
      .withTag("container")
      // The player is just an agent (see game/agent.ts) - tagging it "agent"
      // means behaviour.ts's start() sets up its inventory/wearing containers
      // the same way it does for every other agent.
      .withTag(Tags.AGENT)
      .build();
    props["entities"][PLAYER] = player;
    // The player must remain visible (and so keep verbs like "wait"/"inventory"
    // available) regardless of whether the room is dark.
    player["visibleWhen"] = Entities.makeAlwaysVisibleFn();
}

export const getPlayer : ((env:Env) => Entity) = env => Entities.getEntity(env, PLAYER) as Entity;

export function getLocation(env : Env) : string {
    const player = getPlayer(env);
    return Locations.getLocation(player);
}

export function getLocationEntity(env : Env) : Obj {
    const locationId = getLocation(env);
    return Entities.getEntity(env, locationId);
}
