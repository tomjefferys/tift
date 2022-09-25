import { IdValue } from "../shared";

export type MessageType = "Print" | "Set" | "Look" | "Words" | "Status";

interface Stringable {
    toString : () => string
}

export type OutputMessage = Print | SetVar | Look | Words | Status;

export type OutputConsumer = (message : OutputMessage) => void;

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

export function SetVar(name : string, value : Stringable) : SetVar {
    return {
        type : "Set",
        name : name, 
        value : value.toString()
    }
}