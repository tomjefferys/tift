import { EnvFn, Env } from "tift-types/src/env";
import { control, print } from "../messages/output";
import { OutputConsumer } from "tift-types/src/messages/output";
import { mkResult } from "../script/thunk";
import { bindParams } from "../script/parser";
import { Obj } from "../util/objects"
import _ from "lodash";
import * as Errors from "../util/errors";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Player from "./player";

export const LOCATION = "location";

export const OUTPUT = Symbol("__OUTPUT__");

export const getOutput : ((env:Env) => OutputConsumer) = env => env.get(OUTPUT) as OutputConsumer;

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
        doMove(env, Player.PLAYER, env.get("dest"));
    },
    
    moveTo : env => DEFAULT_FUNCTIONS.setLocation(env),
    move : moveFn,
    getLocation : env => getLocation(env),
    getEntity : env => Entities.getEntity(env, env.getStr("id")),
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
                            Locations.addExit(env, env.getStr("room"), env.getStr("direction"), env.get("target"));
                            return mkResult(null);
                        } ),
    closeExit : bindParams(["room", "direction"], 
                        env => {
                            Locations.closeExit(env, env.getStr("room"), env.getStr("direction"));
                            return mkResult(null);
                        } ),
    hasTag : bindParams(["entityId", "tag"],
                        env => {
                            const entity = Entities.getEntity(env, env.get("entityId"));
                            const result = Entities.entityHasTag(entity, env.getStr("tag"));
                            return mkResult(result);
                        }),
    setTag : bindParams(["entityId", "tag"], 
                         env => {
                            const entity = Entities.getEntity(env, env.get("entityId"));
                            Entities.setEntityTag(entity, env.getStr("tag"));
                            return mkResult(null);
                         }),
    delTag : bindParams(["entityId", "tag"], 
                        env => {
                            const entity = Entities.getEntity(env, env.get("entityId"));
                            Entities.delEntityTag(entity, env.getStr("tag"));
                            return mkResult(null);
                        }),
    reveal : bindParams(["entityId"],
                        env =>{
                            const entity = Entities.getEntity(env, env.get("entityId"));
                            Entities.delEntityTag(entity, "hidden");
                            return mkResult(null);
                        })
}

function doMove(env : Env, entityId : string | object, destinationId : string | object) {
    try {
        const entity = Entities.getEntity(env, entityId);
        const destination = Entities.getEntity(env, destinationId);
        entity[LOCATION] = destination.id;
    } catch(e) {
        throw new Error(`Could not move entity [${Errors.toStr(entityId)}] to [${Errors.toStr(destinationId)}]\n${Errors.getCauseMessage(e)}`);
    }
}

export function write(env : Env, message : string) {
    env.execute("write", {"value": message});
}

export function getLocation(env : Env) : string {
    return Player.getPlayer(env)[LOCATION] as string;
}

export function getLocationEntity(env : Env) : Obj {
    const locationId = env.execute("getLocation", {});
    return Entities.getEntity(env, locationId as string);
}

export function makeDefaultFunctions(obj : Obj) {
    for(const [name, value] of Object.entries(DEFAULT_FUNCTIONS)) {
        obj[name] = value;
    }
}

export function makeOutputConsumer(obj : Obj, outputConsumer : OutputConsumer) {
    obj[OUTPUT] = outputConsumer;
}
