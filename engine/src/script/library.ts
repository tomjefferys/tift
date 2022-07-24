import { bindParams, EnvFn, mkResult } from "./parser"
import { print } from "../messages/output"
import { Env, Obj } from "../env";
import { OUTPUT } from "../enginedefault";

export function addLibraryFunctions(obj : Obj) {
    obj["print"] = PRINT;
    obj["random"] = RANDOM;
}

const PRINT : EnvFn = bindParams(["value"], env => {
    const value = env.get("value"); //(env).value;
    return env.get(OUTPUT)(print(value));
});

const RANDOM : EnvFn = bindParams(["low","high"], env => {
    const low = env.get("low");
    const high = env.get("high");
    return mkResult(Math.floor((Math.random() * (high - low + 1)) + low));
});