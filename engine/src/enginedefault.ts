import { EnvFn, Env, isFound } from "./env";
import { control, OutputConsumer, print } from "./messages/output";
import { VerbBuilder } from "./verb"
import { captureModifier, captureObject, captureIndirectObject, matchAttribute, matchBuilder, attributeMatchBuilder, matchVerb } from "./commandmatcher";
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
import * as Errors from "./util/errors";
import { Entity, EntityBuilder } from "./entity";

const NS_ENTITIES = "entities";
const LOCATION = "location";

// Special locations
const LOCATION_INVENTORY = "INVENTORY";
const LOCATION_WEARING = "WEARING";

export const PLAYER = "__PLAYER__";
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
`{{desc}}

{{#hasItems}}
You can see:
{{/hasItems}}
{{#items}}
 - {{> item}}
{{/items}}`;

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
                     .filter(obj => isEntityMovable(obj) || isEntityNPC(obj));

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
        "items" : items.map(getItemDescription)
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

function isEntityMovable(obj : Obj) : boolean {
    const movableTags = ["carryable", "pushable"];
    return movableTags.some(tag => entityHasTag(obj, tag));
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

const INVENTORY = phaseActionBuilder("inventory")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("inventory")).build(),    
            mkThunk(env => {
                    env.findObjs(obj => obj?.location === "INVENTORY" && isEntity(obj))
                       .forEach(entity => write(env, getName(entity as Nameable)));
    
                    env.findObjs(obj => obj?.location === "WEARING" && isEntity(obj))
                       .forEach(entity => write(env, ` ${getName(entity as Nameable)} (wearing)` ));
                    return mkResult(true);
                })
        )

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
                item.location = LOCATION_INVENTORY;
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

const PUT_IN = phaseActionBuilder("put")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("put"))
                          .withObject(captureObject("item"))
                          .withAttribute(attributeMatchBuilder().withAttribute(matchAttribute("in"))
                                                                .withObject(captureIndirectObject("container")))
                          .build(),
            mkThunk(env => {
                const item = env.get("item");
                const container = env.get("container");
                item[LOCATION] = container.id;
                return mkResult(true);
            }));

const PUT_ON = phaseActionBuilder("put")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("put"))
                          .withObject(captureObject("item"))
                          .withAttribute(attributeMatchBuilder().withAttribute(matchAttribute("on"))
                                                                .withObject(captureIndirectObject("container")))
                          .build(),
            mkThunk(env => {
                const item = env.get("item");
                const container = env.get("container");
                item[LOCATION] = container.id;
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

const WEAR = phaseActionBuilder("wear")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("wear")).withObject(captureObject("wearable")).build(),
            mkThunk(env => {
                const item = env.get("wearable");
                item[LOCATION] = LOCATION_WEARING;
                return mkResult(true);
            }));

const TAKE_OFF = phaseActionBuilder("remove")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("remove")).withObject(captureObject("wearable")).build(),
            mkThunk(env => {
                const item = env.get("wearable");
                item[LOCATION] = LOCATION_INVENTORY;
                return mkResult(true);
            }));

const PUSH = phaseActionBuilder("push")
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("push")).withObject(captureObject("pushable")).withModifier(captureModifier("direction")).build(),
            mkThunk(env => {
                const item =  env.get("pushable");
                const direction = env.get("direction");
                const location = getEntity(env, item[LOCATION]);
                const exits = location["exits"] ?? {};
                const destination = exits[direction];
                if (destination) {
                    item[LOCATION] = destination;
                    write(env, `Pushed ${getName(item as Nameable)} ${direction}`);
                }
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
      new VerbBuilder({"id":"inventory"})
                  .withTrait("intransitive")
                  .withTrait("instant")
                  .withAction(INVENTORY)
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
      new VerbBuilder({"id":"put"})
                  .withTrait("transitive")
                  .withAction(PUT_IN)
                  .withAction(PUT_ON)
                  .withAttribute("in")
                  .withAttribute("on")
                  .withContext("inventory")
                  .withContext("holding")
                  .withContext("environment", "indirect")
                  .build(),
      new VerbBuilder({"id":"examine"})
                  .withTrait("transitive")
                  .withTrait("instant")
                  .withAction(EXAMINE)
                  .build(),
      new VerbBuilder({"id":"wear"})
                  .withTrait("transitive")
                  .withAction(WEAR)
                  .withContext("inventory")
                  .build(),
      new VerbBuilder({"id":"remove"})
                  .withTrait("transitive")
                  .withAction(TAKE_OFF)
                  .withContext("wearing")
                  .build(),
      new VerbBuilder({"id":"push"})
                  .withTrait("transitive")
                  .withAction(PUSH)
                  .withContext("environment")
                  .withContext("location")
                  .withModifier("direction")
                  .build()
];

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
        id : "__PLAYER__",
        type : "player",
        location : start,
        score : 0,
        visitedLocations : []
    }).withVerb("inventory")
      .withVerb("wait")
      .build();
    obj["entities"][PLAYER] = player;
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
export const findEntites : (env : Env, location : Obj) => Obj[] = 
    (env,location) => env.findObjs(obj => obj?.location === location.id && isEntity(obj) && isEntityVisible(obj))
                         .flatMap(obj => [obj, ...findEntites(env, obj)]);

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

