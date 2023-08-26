import { Env } from "tift-types/src/env";
import * as Entities from "./entities";
import * as MultiDict from "../util/multidict";
import { Obj } from "tift-types/src/util/objects";

import * as Errors from "../util/errors";
import * as Output from "./output";
import * as Player from "./player";
import { Optional } from "tift-types/src/util/optional";
import { ARGS } from "../script/parser";
import { EnvFn, mkResult } from "../script/thunk";
import * as MustacheUtils from "../util/mustacheUtils";
import * as Properties from "../properties";
import * as Tags from "./tags";

export const LOCATION = "location";

const ON_MOVE = "onMove";
const ON_REMOVE_CHILD = "onRemoveChild";
const ON_ADD_CHILD = "onAddChild";

export function getLocation(entity : Obj) : string {
    return entity[LOCATION];
}
export function setLocation(env : Env, entity : Obj, location : string | object) : void {
    const locationEntity = Entities.getEntity(env, location);
    const oldLocation = getLocation(entity);
    if (oldLocation) {
        callOnRemoveChild(env, entity, Entities.getEntity(env, oldLocation));
    }
    callOnMove(env, entity, locationEntity);
    entity[LOCATION] = locationEntity.id;
    callOnAddChild(env, entity, locationEntity);
}

function callOnRemoveChild(env : Env, entity : Obj, location : Optional<Obj>) {
    callAncestorFunction(env, entity, location, ON_REMOVE_CHILD);
}
 
function callOnAddChild(env : Env, entity : Obj, location : Obj) {
    callAncestorFunction(env, entity, location, ON_ADD_CHILD);
}

function callOnMove(env : Env, entity : Obj, location : Obj) {
    if (entity[ON_MOVE]) {
        entity[ON_MOVE](env.newChild({ARGS : [location]}));
    }
}

function callAncestorFunction(env : Env, entity: Obj, location : Optional<Obj>, fnName : string) {
    let handled = false;
    if (location && location[fnName]) {
        const newEnv = env.newChild({[ARGS] : [entity]});
        handled = location[fnName](newEnv);
    }
    if (location && !handled) { // FIXME handled is not a boolean
        const parentLocationId  = getLocation(location);
        if (parentLocationId) {
            callAncestorFunction(env, entity, Entities.getEntity(env, parentLocationId), fnName );
        }
    }
}


export function doMove(env : Env, entityId : string | object, destinationId : string | object) {
    try {
        const entity = Entities.getEntity(env, entityId);
        const destination = Entities.getEntity(env, destinationId);
        setLocation(env, entity, destination);
    } catch(e) {
        throw new Error(`Could not move entity [${Errors.toStr(entityId)}] to [${Errors.toStr(destinationId)}]\n${Errors.getCauseMessage(e)}`);
    }
}

/**
 * Recursively find objects at a location and their child objs
 * @param location 
 */
export function findEntites(env : Env, location : Obj) : Obj[] {
    const isDark = Entities.entityHasTag(location, Tags.DARK);
    const canSee = !isDark || isLightSourceAtLocation(env, location);
    return env.findObjs(obj => obj?.location === location.id)
              .filter(obj => Entities.isEntity(obj))
              .filter(obj => canSee || Entities.entityHasTag(obj, Tags.VISIBLE_WHEN_DARK))
              .filter(obj => Entities.isEntityVisible(obj))
              .flatMap(obj => [obj, ...findEntites(env, obj)])  // TODO this should check for 'container' tag
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
    return env.findObjs(obj => Entities.isEntity(obj) && Entities.entityHasTag(obj, Tags.LIGHTSOURCE))
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

/**
 * Find the exit (if present) that leads directly from one roon to another 
 */
export function findExit(env : Env, fromId : string, toId : string) : Optional<string> {
    const fromRoom = Entities.getEntity(env, fromId);
    const toRoom = Entities.getEntity(env, toId);
    const allExits = fromRoom["exits"];
    const [exit, _room] = Object.entries(allExits)
                                .find(([_name, value]) => value === toRoom.id)
                                    ?? [undefined, undefined];
    return exit;
}

export function makeOnMove() : EnvFn {
    return env => {
        const entityId = env.get("id");
        const entity = Entities.getEntity(env, entityId);
        const oldLocation = entity[LOCATION];
        const newLocation = env.get("newLoc");
        const leaveDirection = findExit(env, oldLocation, newLocation);
        const arriveDirection = findExit(env, newLocation, oldLocation);

        const name = entity["name"] ?? entity["id"];
        const playerLocation = Player.getLocation(env);
        if (playerLocation === oldLocation) {
            const message = Properties.getPropertyString(env, "location.messages.leaves");
            const messageEnv = env.newChild({ entity : name, direction : leaveDirection});
            Output.write(env, MustacheUtils.formatString(messageEnv, message));
        }
        if (playerLocation === newLocation.id) {
            const message = Properties.getPropertyString(env, "location.messages.arrives");
            const messageEnv = env.newChild({ entity : name, direction : arriveDirection});
            Output.write(env, MustacheUtils.formatString(messageEnv, message));
        }
        return mkResult(true);
    };
}