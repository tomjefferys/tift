import { IdValue } from "../shared";

interface Stringable {
    toString : () => string
}

export type OutputMessage = Print | SetVar | Look | Words | Status | SaveState | Log

export type OutputConsumer = (message : OutputMessage) => void;

export type StateType = {[key:string | symbol]:unknown};

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

export interface Print {
    type : "Print",
    value : string
}

export interface SetVar {
    type : "Set",
    name : string,
    value : string
}

export interface Look {
    type : "Look",
    room : string,
    objects : string[]
}

export interface Words {
    type : "Words",
    command : string[],
    words : IdValue<string>[]
}

export interface Status {
    type : "Status",
    status : string
}

export interface Log {
    type : "Log", 
    level : LogLevel,
    message : string
}

export interface SaveState {
    type : "SaveState",
    state : StateType
}

export function print(value : Stringable) : OutputMessage {
    return {
        type : "Print",
        value : value.toString()
    }
}

export function words(command : string[], words : IdValue<string>[]) : OutputMessage {
    return {
        type : "Words",
        command : command,
        words : words
    }
}

export function status(status : string) : OutputMessage {
    return {
        type : "Status",
        status : status
    }
}

export function saveState(state : StateType) : OutputMessage {
    return { type : "SaveState", state };
}

export function log(level : LogLevel, message : string) : OutputMessage {
    return { type : "Log", level, message };
}

export function SetVar(name : string, value : Stringable) : SetVar {
    return {
        type : "Set",
        name : name, 
        value : value.toString()
    }
}