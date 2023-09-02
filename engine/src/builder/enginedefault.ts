import { EnvFn } from "tift-types/src/env";
import { control, print } from "../messages/output";
import { getOutput } from "./output";
import { mkResult } from "../script/thunk";
import { ARGS, bindParams } from "../script/parser";
import { Obj } from "../util/objects"
import _ from "lodash";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Player from "./player";

type EnvFnMap = {[key:string]:EnvFn};

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

const DEFAULT_FUNCTIONS : EnvFnMap = {
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
        // TODO consider getting the location here, and if there is one check it matches with the player location
        DEFAULT_FUNCTIONS.write(env);
        return mkResult(null);
    }),
    say : bindParams(["value"], env => {
        DEFAULT_FUNCTIONS.write(env.newChild({"value" : `"${env.get("value")}"`}));
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
    hide : bindParams(["entityId"],
                        env => {
                            const entity = Entities.getEntity(env, env.get("entityId"));
                            Entities.setEntityTag(entity, "hidden");
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
    obj["Math"] = makeMath();
    obj["String"] = makeString();
}

/**
 * Wrap all the javascript math functions, and make them available
 */
function makeMath() : EnvFnMap {
    const math : EnvFnMap = {};
    for(const name of Object.getOwnPropertyNames(Math)) {
        const value = (Math as Obj)[name];
        if (_.isFunction(value)) {
            math[name] = env => {
                const args = env.get(ARGS);
                const result = value(...args);
                return mkResult(result);
            } 
        } else {
            math[name] = value;
        }
    }
    return math;
}

/**
 * Wrap all the javascript string methods, and expose in the style of String.substr("myStr", 2)
 */
function makeString() : EnvFnMap {
    const str : EnvFnMap = {};
    for(const name of Object.getOwnPropertyNames(String.prototype)) {
        const value = (String.prototype as Obj)[name];
        if (_.isFunction(value)) {
            str[name] = env => {
                const args = env.get(ARGS);
                if (args.length === 0) {
                    throw new Error(`Not enough args passed to ${name}`);
                }
                const theStr = args[0];
                if (!_.isString(theStr)) {
                    throw new Error(`First argument passed to ${name} must be a string. ${theStr} is not a string`);
                }
                const fnArgs = args.slice(1);
                const result = (theStr as unknown as Obj)[name](...fnArgs);
                //const result = getStringProperty(theStr, name)(...fnArgs); // TODO figure out why this doesn't work!
                return mkResult(result);
            }
        } else { 
            str[name] = env => {
                const args = env.get(ARGS);
                if (args.length !== 1) {
                    throw new Error(`Expecting exactly 1 argument passed to ${name}, but recieved ${args.length}`);
                }
                const theStr = args[0];
                if (!_.isString(theStr)) {
                    throw new Error(`First argument passed to ${name} must be a string. ${theStr} is not a string`);
                }
                const result = getStringProperty(theStr, name);
                return mkResult(result);
            }
        }
    }
    return str;
}

// Reflectively execute a method on string object
function getStringProperty(str : string, property : string) {
    // Ugly casting is necessary to treat a string as an object
    return (str as unknown as Obj)[property];
}


