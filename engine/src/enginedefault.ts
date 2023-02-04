import { AnyArray, EnvFn, Env, isFound } from "./env";
import { OutputConsumer, print } from "./messages/output";
import { VerbBuilder } from "./verb"
import { captureModifier, captureObject, matchBuilder, matchVerb } from "./commandmatcher";
import { mkResult, mkThunk } from "./script/thunk";
import { phaseActionBuilder } from "./script/phaseaction";
import { makePath } from "./path";
import * as Mustache from "mustache"
import { getName, Nameable } from "./nameable";
import { formatEntityString } from "./util/mustacheUtils";
import * as MultiDict from "./util/multidict";
import { bindParams } from "./script/parser";
import { Obj } from "./util/objects"
import _ from "lodash";
import { Optional } from "./util/optional";
import { getCauseMessage } from "./util/errors";

const NS_ENTITIES = "entities";
const LOCATION = "location";

export const PLAYER = "__PLAYER__";
export const OUTPUT = Symbol("__OUTPUT__");

export interface Player {
    location : string, 
    score : number,
    inventory : AnyArray,
    setLocation : EnvFn,
    visitedLocations : string[]
}

export const getPlayer : ((env:Env) => Player) = env => env.get(PLAYER) as Player;
export const getOutput : ((env:Env) => OutputConsumer) = env => env.get(OUTPUT) as OutputConsumer;

const LOOK_TEMPLATE = 
`{{desc}}

{{#hasItems}}
You can see:
{{/hasItems}}
{{#items}}
 - {{.}}
{{/items}}`;

export const LOOK_COUNT = "__LOOK_COUNT__";

export const LOOK_FN = (env : Env) => {
    const location = getLocationEntity(env);
    const desc = (location["desc"] && formatEntityString(env, location, "desc")) 
                        ?? location["name"]
                        ?? location["id"];
    // Desc should have any moustache expressions expanded
    const items = env.findObjs(obj => obj.location === location.id)
                     .filter(isEntity)
                     .filter(isEntityVisible)
                     .filter(obj => isEntityCarrayable(obj) || isEntityNPC(obj));

    const view = {
        "desc" : desc,
        "hasItems" : Boolean(items.length),
        "items" : items.map(item => getName(item as Nameable)) 
    }

    const output = Mustache.render(LOOK_TEMPLATE, view);

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

function isEntityCarrayable(obj : Obj) : boolean {
    return entityHasTag(obj, "carryable");
}

function isEntityNPC(obj : Obj) : boolean {
    return entityHasTag(obj, "NPC");
}

function entityHasTag(obj : Obj, tag : string) : boolean {
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



const LOOK = phaseActionBuilder("look")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("look")).build(),
            mkThunk(LOOK_FN));

const WAIT = phaseActionBuilder("wait")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("wait")).build(),
            mkThunk(env => {
                write(env,  "Time passes");
                return mkResult(true);
    }));
        

const GO = phaseActionBuilder("go")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("go")).withModifier(captureModifier("direction")).build(),
            mkThunk(env => {
                const location = getLocationEntity(env);
                const destination = location?.exits[env.get("direction")];
                if (destination) {
                    env.execute("moveTo", {"dest" : destination});
                }
                return mkResult(true);
            })
        );

const GET = phaseActionBuilder("get")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("get")).withObject(captureObject("item")).build(),
            mkThunk(env => {
                const item = env.get("item");
                item.location = "INVENTORY";
                return mkResult(true);
            }));

const DROP = phaseActionBuilder("drop")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("drop")).withObject(captureObject("item")).build(), 
            mkThunk(env => {
                const item = env.get("item");
                const location = getLocation(env);
                item.location = location;
                return mkResult(true);
            }));

const EXAMINE = phaseActionBuilder("examine")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("examine")).withObject(captureObject("item")).build(),
            mkThunk(env => {
                const item = env.get("item");
                const output = formatEntityString(env, item, "desc");
                write(env, output);
                return mkResult(true);
            }));

// TODO we should load this from a data file
export const DEFAULT_VERBS = [
      new VerbBuilder({"id":"go"})
                  .withTrait("intransitive")
                  .withAction(GO)
                  .withModifier("direction")
                  .build(),
      new VerbBuilder({"id":"look"})
                  .withTrait("intransitive")
                  .withTrait("instant")
                  .withAction(LOOK)
                  .build(),
      new VerbBuilder({"id":"wait"})
                  .withTrait("intransitive")
                  .withAction(WAIT)
                  .build(),
      new VerbBuilder({"id":"get"})
                  .withTrait("transitive")
                  .withAction(GET)
                  .withContext("environment")
                  .build(),
      new VerbBuilder({"id":"drop"})
                  .withTrait("transitive")
                  .withAction(DROP)
                  .withContext("inventory")
                  .withContext("holding")
                  .build(),
      new VerbBuilder({"id":"examine"})
                  .withTrait("transitive")
                  .withTrait("instant")
                  .withAction(EXAMINE)
                  .build()
];

const moveFn = bindParams(["id"], env => {
    const id = env.getStr("id");
    const DEST = "destination";
    return mkResult({
        to : bindParams([DEST], env => {
            doMove(env, id, env.getStr(DEST));
            return mkResult(null);
        })
    });
});

const DEFAULT_FUNCTIONS : {[key:string]:EnvFn} = {
    setLocation : env => {
        doMove(env, PLAYER, env.getStr("dest"));
    },
    
    moveTo : env => DEFAULT_FUNCTIONS.setLocation(env),
    move : moveFn,
    getLocation : env => getLocation(env),
    getEntity : env => getEntity(env, env.getStr("id")),
    write : env => DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message": print(env.get("value"))})),
    writeMessage : env => getOutput(env)(env.get("message")),
    print : bindParams(["value"], env => {
        DEFAULT_FUNCTIONS.write(env);
        return mkResult(null);
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
                            const entity = getEntity(env, env.getStr("entityId"));
                            const result = entityHasTag(entity, env.getStr("tag"));
                            return mkResult(result);
                        }),
    setTag : bindParams(["entityId", "tag"], 
                         env => {
                            const entity = getEntity(env, env.getStr("entityId"));
                            setEntityTag(entity, env.getStr("tag"));
                            return mkResult(null);
                         }),
    delTag : bindParams(["entityId", "tag"], 
                        env => {
                            const entity = getEntity(env, env.getStr("entityId"));
                            delEntityTag(entity, env.getStr("tag"));
                            return mkResult(null);
                        }),
    reveal : bindParams(["entityId"],
                        env =>{
                            const entity = getEntity(env, env.getStr("entityId"));
                            delEntityTag(entity, "hidden");
                            return mkResult(null);
                        })
}

function doMove(env : Env, entityId : string, destinationId : string) {
    try {
        // FIXME shouldn't the player just be another entity?
        const entity = entityId == PLAYER? env.get(PLAYER) : getEntity(env, entityId);
        const destination = getEntity(env, destinationId);
        entity[LOCATION] = destination.id;
    } catch(e) {
        throw new Error(`Could not move entity [${entityId}] to [${destinationId}]\n${getCauseMessage(e)}`);
    }
}

export function write(env : Env, message : string) {
    env.execute("write", {"value": message});
}

export function getLocation(env : Env) {
    return getPlayer(env).location;
}

export function getEntity(env : Env, id : string) {
    const entity = env.get(makePath([NS_ENTITIES, id]));
    if (!isFound(entity)) {
        throw new Error(`Could not find entity [${id}]`);
    }
    return entity;
}

export function getLocationEntity(env : Env) {
    const locationId = env.execute("getLocation", {});
    return getEntity(env, locationId as string);
}

export function makePlayer(obj : Obj, start : string) {
    const player : Player = {
        location : start,
        score : 0,
        inventory : [],
        setLocation : env => player.location = env.getStr("dest"),
        visitedLocations : []
    };
    obj[PLAYER] = player;
}

export function makeDefaultFunctions(obj : Obj) {
    for(const [name, value] of Object.entries(DEFAULT_FUNCTIONS)) {
        obj[name] = value;
    }
}

export function makeOutputConsumer(obj : Obj, outputConsumer : OutputConsumer) {
    obj[OUTPUT] = outputConsumer;
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

