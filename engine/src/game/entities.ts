import { Obj } from "tift-types/src/util/objects";
import { KIND } from "../util/objects";
import { Env } from "tift-types/src/env";
import { isFound } from "../env";
import { makePath } from "../path";
import * as Errors from "../util/errors";
import _ from "lodash";
import { LOCATION } from "./locations";
import { DARK } from "./tags";
import { EnvFn, mkResult } from "../script/thunk";

// Utility functions pertaining to an entity
export const ENTITY_KIND = "entity";
const NS_ENTITIES = "entities";

export const Types = {
    PLAYER : "player",
    SPECIAL : "special",
    ITEM : "item",
    OBJECT : "object",
    ROOM : "room"
}

export function getEntity(env : Env, entityParam : unknown) : Obj {
    const entity = _.isString(entityParam) 
                        ? env.get(makePath([NS_ENTITIES, entityParam]))
                        : entityParam;
    if (!isFound(entity)) {
        throw new Error(`Could not find entity [${Errors.toStr(entityParam)}]`);
    }
    return entity;
}

export function isEntity(obj : Obj) : boolean {
    return obj[KIND] === ENTITY_KIND;
}

export function isEntityVisible(env : Env, canSee : boolean, obj : Obj) : boolean {
    return (obj["visibleWhen"] ? obj["visibleWhen"](env) : canSee) && !entityHasTag(obj, "hidden");
}

export function isEntityMovable(obj : Obj) : boolean {
    const movableTags = ["carryable", "pushable"];
    return movableTags.some(tag => entityHasTag(obj, tag));
}

export function isEntityNPC(obj : Obj) : boolean {
    return entityHasTag(obj, "NPC");
}

export function entityHasTag(obj : Obj, tag : string) : boolean {
    const tags = obj.tags;
    return _.isArray(tags) && tags.includes(tag);
}

export function setEntityTag(obj : Obj, tag : string) : void {
    if (!entityHasTag(obj, tag)) {
        if (_.isUndefined(obj.tags)) {
            obj.tags = [tag];
        } else if (_.isArray(obj.tags)) {
            obj.tags.push(tag);
        } else {
            throw new Error(`${obj.id} has tags field with is not an array: ${JSON.stringify(obj.tags)}`);
        }
    }
}

export function delEntityTag(obj : Obj, tag : string) : void {
    if (entityHasTag(obj, tag)) {
        const index = obj.tags.indexOf(tag);
        if (index != -1) {
            obj.tags.splice(index, 1);
        }
    }
}

export function makeVisibleWhenDarkFn(optScope? : Env) : EnvFn {
    return env => {
        const scope = optScope ?? env;
        const locationId = scope.get(LOCATION);
        const location = getEntity(scope, locationId);
        const result = entityHasTag(location, DARK);
        return mkResult(result);
    }
}