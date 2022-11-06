import { Obj, AnyArray, EnvFn, Env } from "./env";
import { OutputConsumer, print } from "./messages/output";
import { VerbBuilder } from "./verb"
import { captureModifier, captureObject, matchBuilder, matchVerb } from "./commandmatcher";
import { mkResult, mkThunk } from "./script/thunk";
import { phaseActionBuilder } from "./script/phaseaction";
import { makePath } from "./path";
import * as Mustache from "mustache"
import { getName, Nameable } from "./nameable";

const NS_ENTITIES = "entities";

export const PLAYER = Symbol("__PLAYER__");
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

const LOOK_TEMPLATE : string = 
`{{desc}}

{{#hasItems}}
You can see:
{{/hasItems}}
{{#items}}
 - {{.}}
{{/items}}`;

export const LOOK_FN = (env : Env) => {
    const location = getLocationEntity(env);
    const desc = location["desc"] ?? location["name"] ?? location["id"];
    const items = env.findObjs(obj => obj.location === location.id);

    const view = {
        "desc" : desc,
        "hasItems" : Boolean(items.length),
        "items" : items.map(item => getName(item as Nameable)) 
    }

    const output = Mustache.render(LOOK_TEMPLATE, view);

    write(env, output);

    return mkResult(true);
}

const LOOK = phaseActionBuilder()
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("look")).build(),
            mkThunk(LOOK_FN));

const WAIT = phaseActionBuilder()
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("wait")).build(),
            mkThunk(env => {
                write(env,  "Time passes");
                return mkResult(true);
    }));
        

const GO = phaseActionBuilder()
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

const GET = phaseActionBuilder()
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("get")).withObject(captureObject("item")).build(),
            mkThunk(env => {
                const itemId = env.getStr("item");
                env.set(makePath([NS_ENTITIES, itemId, "location"]), "INVENTORY");
                return mkResult(true);
            }));

const DROP = phaseActionBuilder()
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("drop")).withObject(captureObject("item")).build(), 
            mkThunk(env => {
                const itemId = env.getStr("item");
                const location = getLocation(env); //getPlayer(env).location;
                env.set(makePath([NS_ENTITIES, itemId, "location"]), location);
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
                  .build()
];

const DEFAULT_FUNCTIONS : {[key:string]:EnvFn} = {
    setLocation : env => {
        const dest = env.getStr("dest");
        env.set(makePath([PLAYER, "location"]), dest);
    },
    
    moveTo : env => DEFAULT_FUNCTIONS.setLocation(env),
    getLocation : env => getLocation(env),
    getEntity : env => getEntity(env, env.getStr("id")),
    write : env => DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message": print(env.get("value"))})),
    writeMessage : env => getOutput(env)(env.get("message"))
}

export function write(env : Env, message : string) {
    env.execute("write", {"value": message});
}

export function getLocation(env : Env) {
    return getPlayer(env).location;
}

export function getEntity(env : Env, id : string) {
    return env.get(makePath([NS_ENTITIES, id]));
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