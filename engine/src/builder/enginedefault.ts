import { EnvFn } from "tift-types/src/env";
import { control, print } from "../messages/output";
import { mkResult } from "../script/thunk";
import { ARGS, bindParams } from "../script/parser";
import { Obj } from "../util/objects"
import _ from "lodash";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Player from "./player";
import * as Output from "./output";

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

// FIXME, these all end up being dynamically scoped. This is probably not a good thing,
// but the way print and printAt call write depends on this.  Would allow for implicit printAt if we keep it?
// bindParams third param effectively enables/disabled dynamic scoping
const DEFAULT_FUNCTIONS : EnvFnMap = {
    setLocation : env => {
        Locations.doMove(env, Player.getPlayer(env), env.get("dest"));
    },
    
    moveTo : env => DEFAULT_FUNCTIONS.setLocation(env),
    move : moveFn,
    getLocation : env => Player.getLocation(env),
    write : env => DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message": print(env.get("value"))})),
    writeMessage : env => Output.getOutput(env)(env.get("message")),
    clearBuffer : env => Output.clear(env),
    pause : bindParams(["duration"], env => {
        DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message" : control({ type : "pause", durationMillis : env.get("duration"), interruptable : true})}));
        return mkResult(null);
    }),
    print : bindParams(["value"], env => {
        DEFAULT_FUNCTIONS.write(env);
        return mkResult(null);
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
    getEntity : bindParams(["entityId"], env => mkResult(Entities.getEntity(env, env.get("entityId")))),
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
    obj["Array"] = makeArray();
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
    return mapJSFunctions(String, (name, value) => {
        if (!_.isString(value)) {
            throw new Error(`First argument passed to ${name} must be a string. ${value} is not a string`);
        }
    });
}

function makeArray() : EnvFnMap {
    return mapJSFunctions(Array, (name, value) => {
        if (!_.isArray(value)) {
            throw new Error(`First argument passed to ${name} must be an array. ${value} is not an array`);
        }
    });
}

function mapJSFunctions(type : StringConstructor | ArrayConstructor, checkType : (name : string, value : unknown) => void ) {
    const fnMap : EnvFnMap = {};
    for(const name of Object.getOwnPropertyNames(type.prototype)) {
        const value = (type.prototype as Obj)[name];
        if (_.isFunction(value)) {
            fnMap[name] = env => {
                const args = env.get(ARGS);
                if (args.length === 0) {
                    throw new Error(`Not enough args passed to ${name}`);
                }
                const arg0 = args[0];
                checkType(name, arg0);

                const fnArgs = args.slice(1);
                const result = (arg0 as unknown as Obj)[name](...fnArgs);
                return mkResult(result);
            }
        } else { 
            fnMap[name] = env => {
                const args = env.get(ARGS);
                if (args.length !== 1) {
                    throw new Error(`Expecting exactly 1 argument passed to ${name}, but recieved ${args.length}`);
                }
                const arg0 = args[0];
                checkType(name, arg0);
                const result = getStringProperty(arg0, name);
                return mkResult(result);
            }
        }
    }
    return fnMap;
}



// Reflectively execute a method on string object
function getStringProperty(str : string, property : string) {
    // Ugly casting is necessary to treat a string as an object
    return (str as unknown as Obj)[property];
}


