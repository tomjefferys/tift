import { EntityBuilder } from "./entitybuilder";
import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";
import { Entity } from "../entity";
import * as Entities from "./entities";

export const PLAYER = "__PLAYER__";
export const INVENTORY = "__INVENTORY__";
export const WEARING = "__WEARING__";

export function makePlayer(obj : Obj, start : string) {

    const player = new EntityBuilder({
        id : PLAYER,
        type : "player",
        location : start,
        score : 0,
        visitedLocations : []
    }).withVerb("inventory")
      .withVerb("wait")
      .withTag("container")
      .build();
    obj["entities"][PLAYER] = player;

    // Set up the inventory
    const inventory = new EntityBuilder({
        id : INVENTORY,
        type : "special",
        location : PLAYER
    }).withTag("container")
      .build();

    obj["entities"][INVENTORY] = inventory;

    // Set up the "wearing" inventory (where items go if the are being worn)
    const wearing = new EntityBuilder({
        id : WEARING,
        type : "special",
        location : PLAYER
    }).withTag("container")
      .build();

    obj["entities"][WEARING] = wearing;
}

export const getPlayer : ((env:Env) => Entity) = env => Entities.getEntity(env, PLAYER) as Entity;
