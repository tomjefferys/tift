import { EntityBuilder } from "./entitybuilder";
import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";
import { Entity } from "../entity";
import * as Entities from "./entities";
import * as Locations from "./locations";
import { bindParams } from "../script/parser";

export const PLAYER = "__PLAYER__";
export const INVENTORY = "__INVENTORY__";
export const WEARING = "__WEARING__";

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
      .build();
    props["entities"][PLAYER] = player;
    player["visibleWhen"] = bindParams([], Entities.makeVisibleWhenDarkFn(), env.newChild(player));

    // Set up the inventory
    const inventory = new EntityBuilder({
        id : INVENTORY,
        type : "special",
        location : PLAYER
    }).withTag("container")
      .build();

    props["entities"][INVENTORY] = inventory;

    // Set up the "wearing" inventory (where items go if the are being worn)
    const wearing = new EntityBuilder({
        id : WEARING,
        type : "special",
        location : PLAYER
    }).withTag("container")
      .build();

    props["entities"][WEARING] = wearing;
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
