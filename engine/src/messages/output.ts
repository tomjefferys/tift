export enum MessageType {
    PRINT = "Print",
    SETVAR = "Set",
    LOOK = "Look"
}

interface Stringable {
    toString : () => string
}

export type OutputMessage = Print | SetVar | Look;

export type OutputConsumer = (message : OutputMessage) => void;

export interface Print {
    type : MessageType.PRINT,
    value : string
}

export interface SetVar {
    type : MessageType.SETVAR,
    name : string,
    value : string
}

export interface Look {
    type : MessageType.LOOK,
    room : string,
    objects : string[]
}

export function print(value : Stringable) : OutputMessage {
    return {
        type : MessageType.PRINT,
        value : value.toString()
    }
}

export function SetVar(name : string, value : Stringable) : OutputMessage {
    return {
        type : MessageType.SETVAR,
        name : name, 
        value : value.toString()
    }
}