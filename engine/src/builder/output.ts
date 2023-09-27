import { Env } from "tift-types/src/env";
import { Obj } from "tift-types/src/util/objects";
import { OutputConsumer, OutputMessage } from "tift-types/src/messages/output";

interface OutputProxy {
    write : (message : OutputMessage) => void; 
    flush : () => void;
    hasContent : () => boolean;
    clear : () => void;
}

export const OUTPUT = Symbol("__OUTPUT__");

export function getOutput(env:Env) : OutputConsumer {
    const outputProxy = getOutputProxy(env);
    return message => outputProxy.write(message);
}

export function flush(env : Env) {
    const outputProxy = getOutputProxy(env);
    return outputProxy.flush();
}

export function clear(env : Env) {
    const outputProxy = getOutputProxy(env);
    return outputProxy.clear();
}

export function makeOutputConsumer(obj : Obj, outputConsumer : OutputConsumer) {
    obj[OUTPUT] = makeOutputProxy(outputConsumer);
}

// TODO change to direct call
export function write(env : Env, message : string) {
    env.execute("write", {"value": message});
}

function getOutputProxy(env : Env) : OutputProxy {
    const outputProxy = env.get(OUTPUT);
    if (!outputProxy?.write) {
        throw new Error("No output has been set");
    }
    return outputProxy;
}

function makeOutputProxy(outputConsumer : OutputConsumer) {
    const messages : OutputMessage[] = [];
    const outputProxy = {
      write : (message : OutputMessage) => messages.push(message),
      flush : () => {
        messages.forEach(message => outputConsumer(message));
        messages.length = 0;
      },
      hasContent : () => messages.length > 0,
      clear : () => messages.length = 0
    }
    return outputProxy;
}