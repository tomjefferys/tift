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
import * as Openable from "./traits/openable";
import * as Tags from "./tags"; 

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
    const isVisible = (obj["visibleWhen"] ? Boolean(obj["visibleWhen"](env).getValue()) : canSee) && !entityHasTag(obj, "hidden");
    const isVisibleInContainer = isEntityVisibleInContainer(env, obj);
    return isVisible && isVisibleInContainer;
}

function isEntityVisibleInContainer(env : Env, obj : Obj) : boolean {
    const locationId = obj[LOCATION];
    if (!locationId) {
        return true;
    }
    const location = getEntity(env, locationId);
    if (!isEntityContainer(location)) {
        return true;
    }
    // A container's contents are visible according to its own contentsVisibleWhen
    // predicate, AND only if the container itself is visible within whatever it's
    // inside (checking the whole chain up to the room).
    return isContainerContentsVisible(env, location) && isEntityVisibleInContainer(env, location);
}

// Evaluates a container's contentsVisibleWhen predicate (defaulting to the standard
// open/closed/transparent rule - see makeContainerContentsVisibleFn, injected onto
// every container that doesn't define its own). Shared by the visibility chain above
// and by the get/put access checks in traits/container.ts, so seeing into a container
// and physically reaching into it are gated by the same condition.
export function isContainerContentsVisible(env : Env, container : Obj) : boolean {
    return container["contentsVisibleWhen"]
                ? Boolean(container["contentsVisibleWhen"](env).getValue())
                : true;
}


export function isEntityContainer(obj : Obj) : boolean {
    return entityHasTag(obj, "container");
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

// The default contentsVisibleWhen predicate for containers: contents are visible if
// the container isn't closable, is open, or is transparent (see traits/container.ts,
// which injects this onto every container that doesn't define its own).
export function makeContainerContentsVisibleFn() : EnvFn {
    return env => {
        const container = env.get("this");
        const result = !Openable.isClosable(container)
                    || Openable.isOpen(container)
                    || entityHasTag(container, Tags.TRANSPARENT);
        return mkResult(result);
    }
}

// Always visible, regardless of darkness or anything else. Used by the player entity,
// which must remain visible (so its verbs like "wait"/"inventory" stay available)
// whether or not the room is dark.
export function makeAlwaysVisibleFn() : EnvFn {
    return () => mkResult(true);
}

// Entities tagged onlyVisibleInDark are visible only when their location is dark (and
// hidden otherwise) - eg glow-in-the-dark items that would otherwise be invisible.
export function makeVisibleOnlyInDarkFn(optScope? : Env) : EnvFn {
    return env => {
        const scope = optScope ?? env;
        const locationId = scope.get(LOCATION);
        const location = getEntity(scope, locationId);
        const result = entityHasTag(location, DARK);
        return mkResult(result);
    }
}