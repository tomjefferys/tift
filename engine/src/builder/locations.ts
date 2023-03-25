import { Env } from "tift-types/src/env";
import * as Entities from "./entities";
import * as MultiDict from "../util/multidict";
import { Obj } from "tift-types/src/util/objects";

export const DARK = "dark";
const LIGHTSOURCE = "lightSource";

/**
 * Recursively find objects at a location and their child objs
 * @param location 
 */
export function findEntites(env : Env, location : Obj) : Obj[] {
    const canSee = !Entities.entityHasTag(location, DARK) || isLightSourceAtLocation(env, location);
    return canSee ? env.findObjs(obj => obj?.location === location.id && Entities.isEntity(obj) && Entities.isEntityVisible(obj))
                         .flatMap(obj => [obj, ...findEntites(env, obj)])  // TODO this should check for 'container' tag
                  : [];
}

export function isAtLocation(env : Env, location : string, obj : Obj) : boolean {
    let result = (obj.location === location);
    if (!result && obj.location) {
        const objLocation = Entities.getEntity(env, obj.location);
        result = isAtLocation(env, location, objLocation);
    }
    return result;
}

export function isLightSourceAtLocation(env : Env, location : Obj) : boolean {
    return env.findObjs(obj => Entities.isEntity(obj) && Entities.entityHasTag(obj, LIGHTSOURCE))
            .some(entity => isAtLocation(env, location.id, entity));
}

export function addExit(env : Env, roomId : string, direction : string, target : string) {
    const room = Entities.getEntity(env, roomId);
    room.exits[direction] = target;
    MultiDict.add(room.verbModifiers, "direction", direction);
}

export function closeExit(env : Env, roomId : string, direction : string) {
    const room = Entities.getEntity(env, roomId);
    delete room.exits[direction];
    MultiDict.remove(room.verbModifiers, "direction", direction);
}
