import { Env } from "tift-types/src/env";
import { Obj } from "tift-types/src/util/objects";
import { OutputConsumer, OutputMessage } from "tift-types/src/messages/output";
import { print } from "../messages/output";

interface OutputProxy {
    write : (message : OutputMessage) => void; 
    flush : () => void;
    messages : OutputMessage[];
    hasContent : () => boolean;
    clear : () => void;
}

export const MAIN_DESC_TAB = "mainDesc";
export const ITEMS_DESC_TAB = "itemsDesc";

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

export function write(env : Env, message : string, tag? : string) {
    const outputProxy = getOutputProxy(env);
    outputProxy.write(print(message, tag));
}

export function pushOutputProxy(env : Env) : Env {
    const child = {
        [OUTPUT] : makeOutputProxy(getOutput(env))
    }
    return env.newChild(child);
}

export function getMessages(env : Env) : OutputMessage[] {
    const outputProxy = getOutputProxy(env);
    return outputProxy.messages;
}

function getOutputProxy(env : Env) : OutputProxy {
    const outputProxy = env.get(OUTPUT);
    if (!outputProxy?.write) {
        throw new Error("No output has been set");
    }
    return outputProxy;
}

function makeOutputProxy(outputConsumer : OutputConsumer) : OutputProxy {
    const messages : OutputMessage[] = [];
    const outputProxy = {
      write : (message : OutputMessage) => messages.push(message),
      flush : () => {
        messages.forEach(message => outputConsumer(message));
        messages.length = 0;
      },
      hasContent : () => messages.length > 0,
      clear : () => messages.length = 0,
      messages
    }
    return outputProxy;
}