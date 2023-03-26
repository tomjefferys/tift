import { bindParams } from "../script/parser"
import { EnvFn, mkResult } from "../script/thunk"
import { print } from "../messages/output"
import { Obj } from "../util/objects";
import * as Output from "./output";

export function addLibraryFunctions(obj : Obj) {
    obj["print"] = PRINT;
    obj["random"] = RANDOM;
}

const PRINT : EnvFn = bindParams(["value"], env => {
    const value = env.get("value");
    Output.getOutput(env)(print(value));
    return mkResult(null);
});

const RANDOM : EnvFn = bindParams(["low","high"], env => {
    const low = env.get("low");
    const high = env.get("high");
    return mkResult(Math.floor((Math.random() * (high - low + 1)) + low));
});