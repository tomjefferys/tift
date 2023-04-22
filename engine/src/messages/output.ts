import { History } from "tift-types/src/util/historyproxy";
import { ControlType } from "tift-types/src/messages/controltype";
import { OutputMessage, Word, LogLevel, SetVar } from "tift-types/src/messages/output";

interface Stringable {
    toString : () => string
}

export const word = (id : string, value : string, type : "option" | "control") : Word => ({id, value, type});

export function print(value : Stringable) : OutputMessage {
    return {
        type : "Print",
        value : value.toString()
    }
}

export function words(command : string[], words : Word[]) : OutputMessage {
    return {
        type : "Words",
        command : command,
        words : words
    }
}

export function status(title : string, undoable : boolean, redoable : boolean) : OutputMessage {
    return {
        type : "Status",
        status : { title, undoable, redoable }
    }
}

export function saveState(state : History) : OutputMessage {
    return { type : "SaveState", state };
}

export function log(level : LogLevel, message : string) : OutputMessage {
    return { type : "Log", level, message };
}

export function control(value : ControlType) : OutputMessage {
    return { type : "Control", value };
}

export function SetVar(name : string, value : Stringable) : SetVar {
    return {
        type : "Set",
        name : name, 
        value : value.toString()
    }
}