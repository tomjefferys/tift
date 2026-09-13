import { Env } from "tift-types/src/env";
import { EnvFn } from "../script/thunk";

import { control, print, log } from "../messages/output";
import { mkResult } from "../script/thunk";
import { ARGS, bindParams, NO_ARGS_LENGTH_CHECK, markLazy } from "../script/parser";
import { Obj } from "../util/objects"
import _ from "lodash";
import * as Entities from "./entities";
import * as Locations from "./locations";
import * as Player from "./player";
import * as Output from "./output";
import * as Nameable from "../nameable";
import * as Metadata from "./metadata";
import * as Mustache from "../util/mustacheUtils";
import * as Properties from "../properties";
import { executeCommand } from "../commandexecutor";
import { getContext } from "./context";
import { createPlan } from "../commandplanner";

type Nameable = Nameable.Nameable;

type EnvFnMap = {[key:string]:EnvFn};

const moveFn = bindParams(["id"], env => {
    const id = env.get("id");
    const DEST = "destination";
    const DIRECTION = "direction";
    return mkResult({
        to : bindParams([DEST], env => {
            Locations.doMove(env, id, env.get(DEST));
            return mkResult(null);
        }),
        dir : bindParams([DIRECTION], env => {
            const entity = Entities.getEntity(env, id);
            const location = Entities.getEntity(env, Locations.getLocation(entity));
            const destination = Locations.getExitDestination(location, env.get(DIRECTION));
            if (destination) {
                Locations.doMove(env, id, destination);
            }
            return mkResult(null);
        })
    });
});

// FIXME, these all end up being dynamically scoped. This is probably not a good thing,
// but the way print and printAt call write depends on this.  Would allow for implicit printAt if we keep it?
// bindParams third param effectively enables/disabled dynamic scoping
const DEFAULT_FUNCTIONS : EnvFnMap = {
    setLocation : bindParams(["dest"], env => {
        Locations.doMove(env, Player.getPlayer(env), env.get("dest"));
        return mkResult(true);
    }),
    move : moveFn,
    getLocation : env => mkResult(Player.getLocation(env)),
    write: env => DEFAULT_FUNCTIONS.writeMessage(env.newChild({ "message": print(env.get("value")) })),
    writeMessage: env => {
        Output.getOutput(env)(env.get("message"));
        return mkResult(true);
    },
    clearBuffer : env => {
        Output.clear(env);
        return mkResult(true);
    },
    pause : bindParams(["duration"], env => {
        DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message" : control({ type : "pause", durationMillis : env.get("duration"), interruptable : true})}));
        return mkResult(null);
    }),
    print : bindParams(["value"], env => {
        DEFAULT_FUNCTIONS.write(env);
        return mkResult(true);
    }),
    error : bindParams(["value"], env => {
        DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message" : log( "error", env.get("value"))}));
        return mkResult(false);
    }),
    warn : bindParams(["value"], env => {
        DEFAULT_FUNCTIONS.writeMessage(env.newChild({"message" : log( "warn", env.get("value"))}));
        return mkResult(false);
    }),
    getRoom : env => {
                        const args = env.get(ARGS);
                        const direction = args.length === 1 ? args[0] : args[1];
                        const room = args.length === 1
                                        ? Player.getLocationEntity(env)
                                        : Entities.getEntity(env, args[0]);
                        return mkResult(Locations.getExitDestination(room, direction));
                    },
    getExits : bindParams(["room"], env => {
                            const room = Entities.getEntity(env, env.get("room"));
                            const exits = Object.keys(room.exits ?? {})
                                                 .reduce((acc : Obj, direction : string) => {
                                                     acc[direction] = Locations.getExitDestination(room, direction);
                                                     return acc;
                                                 }, {});
                            return mkResult(exits);
                        }),
    openExit : bindParams(["room", "direction", "target"],
                        env => {
                            Locations.addExit(env, env.get("room"), env.getStr("direction"), env.get("target"));
                            return mkResult(null);
                        } ),
    closeExit : bindParams(["room", "direction"], 
                        env => {
                            Locations.closeExit(env, env.get("room"), env.getStr("direction"));
                            return mkResult(null);
                        } ),
    getEntity : bindParams(["entityId"], env => mkResult(Entities.getEntity(env, env.get("entityId")))),
    random : bindParams(["low","high"], env => {
                            const low = env.get("low");
                            const high = env.get("high");
                            return mkResult(Math.floor((Math.random() * (high - low + 1)) + low));
                        }),
    isAtLocation : bindParams(["item", "location"],
                        env => {
                            const location = env.get("location");
                            const locationStr = Entities.getEntity(env, location).id;
                            const itemEntity = Entities.getEntity(env, env.get("item"));
                            const atLocation = Locations.isAtLocation(env, locationStr, itemEntity);
                            return mkResult(atLocation);
                        }),
    itemsAtLocation : bindParams(["location"],
                        env => {
                            const location = env.get("location");
                            const locationEntity = Entities.getEntity(env, location);
                            const items = Locations.findEntities(env, locationEntity);
                            return mkResult(items);
                        }),
    moveItemTo : bindParams(["item", "location"],
                        env => {
                            Locations.setLocation(env, env.get("item"), env.get("location"));
                            return mkResult(true);
                        }),
    getName : bindParams(["entity"], env => {
                            const entity = Entities.getEntity(env, env.get("entity"));
                            return mkResult(Nameable.getName(entity as Nameable));
                        }),
    getFullName : bindParams(["entity"], env => {
                            const entity = Entities.getEntity(env, env.get("entity"));
                            return mkResult(Nameable.getFullName(entity as Nameable));
                        }),
    isInContainer : bindParams(["entity"], env => {
                            const entity = Entities.getEntity(env, env.get("entity"));
                            return mkResult(Locations.isInContainer(env, entity));
                        }),
    tick : env => {
        env.setTransient("tick", true);
        return mkResult(true);
    },
    obj : _env => { return mkResult({}) },
    getProperty : bindParams(["name", "defaultValue"], env => {
                            const defaultValue = env.get("defaultValue");
                            const value = Properties.getProperty(env, env.get("name"), defaultValue);
                            return mkResult(value);
                        }),
    getPlayer : env => mkResult(Player.getPlayer(env)),
    getMetadata : bindParams(["name"], env => mkResult(Metadata.get(env)[env.get("name")])),
    format : bindParams(["template"], env => {
                            const template = env.get("template");
                            const output = Mustache.formatString(env, template);
                            return mkResult(output);
                        }),
    // executeCommand(command, full?) - run a fully formed command (eg from a search
    // performed by an autonomous agent/NPC) against the current context. Takes an
    // optional second argument (defaulting to false) to also run the before/after-turn
    // rule phases around the command. Returns true if a matching action was executed,
    // false if the command didn't match anything in the current context.
    executeCommand : env => {
                            const args = env.get(ARGS);
                            const command = args[0] as string[];
                            const full = (args[1] as boolean) ?? false;
                            const context = getContext(env);
                            return mkResult(executeCommand(env, context, command, full));
                        },
    // createPlan(predicate, verbList?, depth?) - search for a sequence of commands that
    // makes `predicate` true (eg getScore() == getMetadata('maxScore')), simulating commands
    // against forked copies of the state so the real game is never touched. `predicate` is
    // marked lazy (see markLazy) so it arrives unresolved and can be re-checked against each
    // simulated state, rather than being evaluated once against the current one. `verbList`
    // restricts which verbs are tried at each step (default: all verbs available in context);
    // `depth` bounds how many commands the search will try before giving up (default:
    // commandplanner.DEFAULT_PLAN_DEPTH). Returns the plan as a list of commands (each a list
    // of word ids), or an empty list if no plan was found.
    //
    // KNOWN LIMITATION: "the real game is never touched" doesn't hold for functions defined on
    // a nested sub-object (as opposed to directly on an entity) - see
    // game/functionbuilder.ts#makeCompileFunction. Calling one during the search can read stale
    // state and leak writes into the real game. See commandplanner.ts's module doc comment.
    createPlan : markLazy(env => {
                            const args = env.get(ARGS);
                            const predicate = args[0] as EnvFn;
                            const verbList = (args[1] ? args[1](env).getValue() : []) as string[];
                            const depth = (args[2] ? args[2](env).getValue() : undefined) as number | undefined;
                            const plan = createPlan(env, predicate, verbList, depth);
                            return mkResult(plan ?? []);
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

                const fnArgs = args.slice(1).map(
                    (arg : unknown) => 
                        _.isFunction(arg)
                            ? mapEnvFunctionToJS(env, arg as EnvFn)
                            : arg
                )
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

// Wrap a function that is defined in the environment, and make it available in the JS context
function mapEnvFunctionToJS(env : Env, fn : EnvFn) : unknown {
    return (...args : unknown[]) => {
        const childEnv = env.newChild({
                [ARGS] : args,
                // Disable arg length checking
                // Some JS functions eg Array.map, have optional arguments
                [NO_ARGS_LENGTH_CHECK] : true,
            });
        return fn(childEnv).getValue();
    }
}



// Reflectively execute a method on string object
function getStringProperty(str : string, property : string) {
    // Ugly casting is necessary to treat a string as an object
    return (str as unknown as Obj)[property];
}


