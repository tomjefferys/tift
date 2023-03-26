import { Env } from "tift-types/src/env";
import { Obj } from "tift-types/src/util/objects";
import { OutputConsumer } from "tift-types/src/messages/output";

export const OUTPUT = Symbol("__OUTPUT__");

export const getOutput : ((env:Env) => OutputConsumer) = env => env.get(OUTPUT) as OutputConsumer;

export function makeOutputConsumer(obj : Obj, outputConsumer : OutputConsumer) {
    obj[OUTPUT] = outputConsumer;
}

export function write(env : Env, message : string) {
    env.execute("write", {"value": message});
}
