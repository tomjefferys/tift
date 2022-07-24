import { bindParams, EnvFn, mkResult } from "./parser"
import { print } from "../messages/output"

const PRINT : EnvFn = bindParams(["value"], env => {
    const value = env.get("value"); //(env).value;
    return env.get("OUTPUT")(print(value));
});

const RANDOM : EnvFn = bindParams(["low","high"], env => {
    const low = env.get("low");
    const high = env.get("high");
    return mkResult(Math.floor((Math.random() * (high - low + 1)) + low);
});