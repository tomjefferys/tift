import { Obj, AnyArray, EnvFn, Env } from "./env";
import { OutputConsumer, print } from "./messages/output";
import { getMatcher, match, capture } from "./actionmatcher"
import { VerbBuilder, VerbTrait } from "./verb"

const PLAYER = Symbol("__PLAYER__");
const OUTPUT = Symbol("__OUTPUT__");

export interface Player {
    location : string, 
    score : number,
    inventory : AnyArray,
    setLocation : EnvFn
}

export const getPlayer : ((env:Env) => Player) = env => env.get(PLAYER) as Player;
export const getOutput : ((env:Env) => OutputConsumer) = env => env.get(OUTPUT) as OutputConsumer;

const LOOK = {
    matcher : getMatcher([match("look")]),
    action : (env:Env) => {
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
    } 
}

const GET = {
    matcher : getMatcher([match("get"), capture("item")]),
    action : (env : Env) => {
        const itemId = env.getStr("item");
        env.set([itemId,"location"], "INVENTORY");
    }
}

const DROP = {
    matcher : getMatcher([match("drop"), capture("item")]),
    action : (env : Env) => {
        const itemId = env.getStr("item");
        const location = getPlayer(env).location;
        env.set([itemId,"location"], location);
    }
}

// TODO we should load this from a data file
export const DEFAULT_VERBS = [
      new VerbBuilder({"id":"go"})
                  .withTrait(VerbTrait.Intransitive)
                  .withModifier("direction")
                  .build(),
      new VerbBuilder({"id":"look"})
                  .withTrait(VerbTrait.Intransitive)
                  .withAction(LOOK)
                  .build(),
      new VerbBuilder({"id":"get"})
                  .withTrait(VerbTrait.Transitive)
                  .withAction(GET)
                  .withContext("environment")
                  .build(),
      new VerbBuilder({"id":"drop"})
                  .withTrait(VerbTrait.Transitive)
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
    getEntity : env => env.get(env.getStr("id")),
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