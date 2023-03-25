import { isFound } from "../env";
import { EnvFn, Env } from "tift-types/src/env";
import { control, print } from "../messages/output";
import { OutputConsumer } from "tift-types/src/messages/output";
import { mkResult } from "../script/thunk";
import { makePath } from "../path";
import * as Mustache from "mustache"
import { getName, Nameable } from "../nameable";
import { formatEntityString } from "../util/mustacheUtils";
import * as MultiDict from "../util/multidict";
import { bindParams } from "../script/parser";
import { Obj } from "../util/objects"
import _ from "lodash";
import { Optional } from "tift-types/src/util/optional";
import * as Errors from "../util/errors";
import { Entity } from "../entity";
import { EntityBuilder } from "./entitybuilder";

const NS_ENTITIES = "entities";
export const LOCATION = "location";

export const DARK = "dark";
const LIGHTSOURCE = "lightSource";

export const PLAYER = "__PLAYER__";
export const INVENTORY = "__INVENTORY__";
export const WEARING = "__WEARING__";

export const OUTPUT = Symbol("__OUTPUT__");

export interface Player {
    location : string, 
    score : number,
    setLocation : EnvFn,
    visitedLocations : string[]
}

export const getPlayer : ((env:Env) => Entity) = env => getEntity(env, PLAYER) as Entity;
export const getOutput : ((env:Env) => OutputConsumer) = env => env.get(OUTPUT) as OutputConsumer;

const LOOK_TEMPLATE = 
`{{#isDark}}
  It is dark, you cannot see a thing.
{{/isDark}}

{{^isDark}}
{{desc}}

{{#hasItems}}
You can see:
{{/hasItems}}
{{#items}}
- {{> item}}
{{/items}}
{{/isDark}}`;

const LOOK_ITEM_TEMPLATE = `{{name}}{{#location}} ( in {{.}} ){{/location}}`;

export const LOOK_COUNT = "__LOOK_COUNT__";

export const LOOK_FN = (env : Env) => {
    const location = getLocationEntity(env);

    const desc = (location["desc"] && formatEntityString(env, location, "desc")) 
                        ?? location["name"]
                        ?? location["id"];

    const items = findEntites(env, location)
                     .filter(isEntity)
                     .filter(isEntityVisible)
                     .filter(obj => isEntityMovable(obj) || isEntityNPC(obj))
                     .filter(obj => !isAtLocation(env, PLAYER, obj));
                    
    const isDark = entityHasTag(location, DARK) && !isLightSourceAtLocation(env, location);

    const getItemDescription = (item : Obj) => {
        const itemLocation = item[LOCATION];
        const locationObj = (itemLocation !== location.id) 
                ? { location : getName(getEntity(env, itemLocation) as Nameable)}
                : {};
        return { name : getName(item as Nameable), ...locationObj };
    }

    // Desc should have any moustache expressions expanded
    const view = {
        "desc" : desc,
        "hasItems" : Boolean(items.length),
        "items" : items.map(getItemDescription),
        "isDark" : isDark
    }

    const output = Mustache.render(LOOK_TEMPLATE, view, { item : LOOK_ITEM_TEMPLATE });

    // Update look count if it exists. It should only have been created if needed by one of the mustache functions
    // FIXME related code is split between here and mustacheUtils. Should try to move it to one place.
    const lookCount : Optional<number> = location[LOOK_COUNT];
    if (lookCount !== undefined) {
        location[LOOK_COUNT] = lookCount + 1;
    }
    write(env, output);

    return mkResult(true);
}

export function isEntity(obj : Obj) : boolean {
    // TODO find a better way of doing this
    return Boolean(obj.type);
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

function setEntityTag(obj : Obj, tag : string) : void {
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

function delEntityTag(obj : Obj, tag : string) : void {
    if (entityHasTag(obj, tag)) {
        const index = obj.tags.indexOf(tag);
        if (index != -1) {
            obj.tags.splice(index, 1);
        }
    }
}

const moveFn = bindParams(["id"], env => {
    const id = env.get("id");
    const DEST = "destination";
    return mkResult({
        to : bindParams([DEST], env => {
            doMove(env, id, env.get(DEST));
            return mkResult(null);
        })
    });
});

const DEFAULT_FUNCTIONS : {[key:string]:EnvFn} = {
    setLocation : env => {
        doMove(env, PLAYER, env.get("dest"));
    },
    
    moveTo : env => DEFAULT_FUNCTIONS.setLocation(env),
    move : moveFn,
    getLocation : env => getLocation(env),
    getEntity : env => getEntity(env, env.getStr("id")),
    write : env => DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message": print(env.get("value"))})),
    writeMessage : env => getOutput(env)(env.get("message")),
    pause : bindParams(["duration"], env => {
        DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message" : control({ type : "pause", durationMillis : env.get("duration"), interruptable : true})}));
        return mkResult(null);
    }),
    print : bindParams(["value"], env => {
        DEFAULT_FUNCTIONS.write(env);
        return mkResult(null);
    }),
    not : bindParams(["value"], env => {
        return mkResult(!env.get("value"));
    }),
    openExit : bindParams(["room", "direction", "target"], 
                        env => {
                            addExit(env, env.getStr("room"), env.getStr("direction"), env.get("target"));
                            return mkResult(null);
                        } ),
    closeExit : bindParams(["room", "direction"], 
                        env => {
                            closeExit(env, env.getStr("room"), env.getStr("direction"));
                            return mkResult(null);
                        } ),
    hasTag : bindParams(["entityId", "tag"],
                        env => {
                            const entity = getEntity(env, env.get("entityId"));
                            const result = entityHasTag(entity, env.getStr("tag"));
                            return mkResult(result);
                        }),
    setTag : bindParams(["entityId", "tag"], 
                         env => {
                            const entity = getEntity(env, env.get("entityId"));
                            setEntityTag(entity, env.getStr("tag"));
                            return mkResult(null);
                         }),
    delTag : bindParams(["entityId", "tag"], 
                        env => {
                            const entity = getEntity(env, env.get("entityId"));
                            delEntityTag(entity, env.getStr("tag"));
                            return mkResult(null);
                        }),
    reveal : bindParams(["entityId"],
                        env =>{
                            const entity = getEntity(env, env.get("entityId"));
                            delEntityTag(entity, "hidden");
                            return mkResult(null);
                        })
}

function doMove(env : Env, entityId : string | object, destinationId : string | object) {
    try {
        // FIXME shouldn't the player just be another entity?
        const entity = entityId === PLAYER? env.get(PLAYER) : getEntity(env, entityId);
        const destination = getEntity(env, destinationId);
        entity[LOCATION] = destination.id;
    } catch(e) {
        throw new Error(`Could not move entity [${Errors.toStr(entityId)}] to [${Errors.toStr(destinationId)}]\n${Errors.getCauseMessage(e)}`);
    }
}

export function write(env : Env, message : string) {
    env.execute("write", {"value": message});
}

export function getLocation(env : Env) : string {
    return getPlayer(env)[LOCATION] as string;
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

export function getLocationEntity(env : Env) : Obj {
    const locationId = env.execute("getLocation", {});
    return getEntity(env, locationId as string);
}

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

export function makeDefaultFunctions(obj : Obj) {
    for(const [name, value] of Object.entries(DEFAULT_FUNCTIONS)) {
        obj[name] = value;
    }
}

export function makeOutputConsumer(obj : Obj, outputConsumer : OutputConsumer) {
    obj[OUTPUT] = outputConsumer;
}

/**
 * Recursively find objects at a location and their child objs
 * @param location 
 */
export function findEntites(env : Env, location : Obj) : Obj[] {
    const canSee = !entityHasTag(location, DARK) || isLightSourceAtLocation(env, location);
    return canSee ? env.findObjs(obj => obj?.location === location.id && isEntity(obj) && isEntityVisible(obj))
                         .flatMap(obj => [obj, ...findEntites(env, obj)])  // TODO this should check for 'container' tag
                  : [];
}

export function isAtLocation(env : Env, location : string, obj : Obj) : boolean {
    let result = (obj.location === location);
    if (!result && obj.location) {
        const objLocation = getEntity(env, obj.location);
        result = isAtLocation(env, location, objLocation);
    }
    return result;
}

export function isLightSourceAtLocation(env : Env, location : Obj) : boolean {
    return env.findObjs(obj => isEntity(obj) && entityHasTag(obj, LIGHTSOURCE))
            .some(entity => isAtLocation(env, location.id, entity));
}

function addExit(env : Env, roomId : string, direction : string, target : string) {
    const room = getEntity(env, roomId);
    room.exits[direction] = target;
    MultiDict.add(room.verbModifiers, "direction", direction);
}

function closeExit(env : Env, roomId : string, direction : string) {
    const room = getEntity(env, roomId);
    delete room.exits[direction];
    MultiDict.remove(room.verbModifiers, "direction", direction);
}

