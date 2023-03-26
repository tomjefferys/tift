import { EnvFn } from "tift-types/src/env";
import { control, print } from "../messages/output";
import { getOutput } from "./output";
import { mkResult } from "../script/thunk";
import { bindParams } from "../script/parser";
import { Obj } from "../util/objects"
import _ from "lodash";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Player from "./player";

const moveFn = bindParams(["id"], env => {
    const id = env.get("id");
    const DEST = "destination";
    return mkResult({
        to : bindParams([DEST], env => {
            Locations.doMove(env, id, env.get(DEST));
            return mkResult(null);
        })
    });
});

const DEFAULT_FUNCTIONS : {[key:string]:EnvFn} = {
    setLocation : env => {
        Locations.doMove(env, Player.getPlayer(env), env.get("dest"));
    },
    
    moveTo : env => DEFAULT_FUNCTIONS.setLocation(env),
    move : moveFn,
    getLocation : env => Player.getLocation(env),
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
                        }),
    random : bindParams(["low","high"], env => {
                            const low = env.get("low");
                            const high = env.get("high");
                            return mkResult(Math.floor((Math.random() * (high - low + 1)) + low));
                        })
}

export function makeDefaultFunctions(obj : Obj) {
    for(const [name, value] of Object.entries(DEFAULT_FUNCTIONS)) {
        obj[name] = value;
    }
}
