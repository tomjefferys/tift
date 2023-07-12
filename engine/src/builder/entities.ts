import { Obj } from "tift-types/src/util/objects";
import { Env } from "tift-types/src/env";
import { isFound } from "../env";
import { makePath } from "../path";
import * as Errors from "../util/errors";
import _ from "lodash";

// Utility functions pertaining to an entity
export const ENTITY_TYPE = "entity";
const NS_ENTITIES = "entities";

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
    return obj.type === ENTITY_TYPE;
}

export function isEntityVisible(obj : Obj) : boolean {
    return !entityHasTag(obj, "hidden");
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