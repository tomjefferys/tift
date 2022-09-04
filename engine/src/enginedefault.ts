import { Obj, AnyArray, EnvFn, Env } from "./env";
import { OutputConsumer, print } from "./messages/output";
import { VerbBuilder } from "./verb"
import { captureObject, matchBuilder, matchVerb } from "./commandmatcher";
import { mkResult, mkThunk } from "./script/thunk";
import { phaseActionBuilder } from "./script/phaseaction";

const NS_ENTITIES = "entities";

const PLAYER = Symbol("__PLAYER__");
export const OUTPUT = Symbol("__OUTPUT__");

export interface Player {
    location : string, 
    score : number,
    inventory : AnyArray,
    setLocation : EnvFn
}

export const getPlayer : ((env:Env) => Player) = env => env.get(PLAYER) as Player;
export const getOutput : ((env:Env) => OutputConsumer) = env => env.get(OUTPUT) as OutputConsumer;

const LOOK = phaseActionBuilder()
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("look")).build(),
            mkThunk(env => {
                const location = env.execute("getLocation", {});
                const entity = env.execute("getEntity", {"id":location}) as Obj;
                const desc = entity["desc"] ?? entity["name"] ?? entity["id"];
                env.execute("write", {"value":desc});
                env.execute("write", {"value":"<br/>"});

                const items = env.findObjs(obj => obj.location === location);

                for(const item of items) {
                    env.execute("write", {"value": item["name"] ?? item["id"]});
                    env.execute("write", {"value":"<br/>"});
                }
                return mkResult(true);
    }));

const GET = phaseActionBuilder()
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("get")).withObject(captureObject("item")).build(),
            mkThunk(env => {
                const itemId = env.getStr("item");
                env.set([NS_ENTITIES, itemId, "location"], "INVENTORY");
                return mkResult(true);
            }));

const DROP = phaseActionBuilder()
        .withPhase("main")
        .withMatcherOnMatch(
            matchBuilder().withVerb(matchVerb("drop")).withObject(captureObject("item")).build(), 
            mkThunk(env => {
                const itemId = env.getStr("item");
                const location = getPlayer(env).location;
                env.set([NS_ENTITIES, itemId, "location"], location);
                return mkResult(true);
            }));

// TODO we should load this from a data file
export const DEFAULT_VERBS = [
      new VerbBuilder({"id":"go"})
                  .withTrait("intransitive")
                  .withModifier("direction")
                  .build(),
      new VerbBuilder({"id":"look"})
                  .withTrait("intransitive")
                  .withAction(LOOK)
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
        env.set([PLAYER, "location"], dest);
    },
    
    moveTo : env => DEFAULT_FUNCTIONS.setLocation(env),
    getLocation : env => getPlayer(env).location,
    getEntity : env => env.get([NS_ENTITIES, env.getStr("id")]),
    write : env => DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message": print(env.get("value"))})),
    writeMessage : env => getOutput(env)(env.get("message"))
}

export function makePlayer(obj : Obj, start : string) {
    const player : Player = {
        location : start,
        score : 0,
        inventory : [],
        setLocation : env => player.location = env.getStr("dest")
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