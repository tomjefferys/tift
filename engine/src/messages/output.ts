import { History } from "tift-types/src/util/historyproxy";
import { ControlType } from "tift-types/src/messages/controltype";
import { OutputMessage, LogLevel, SetVar, Properties } from "tift-types/src/messages/output";
import { Word } from "tift-types/src/messages/word";

interface Stringable {
    toString : () => string
}

type WordType = "option" | "control" | "select";

export const word = (id : string, value : string, type : WordType) : Word => ({id, value, type});

export function print(value : Stringable, tag? : string) : OutputMessage {
    return {
        type : "Print",
        value : value.toString(),
        ...(tag? { tag } : {})
    }
}

export function words(command : Word[], words : Word[]) : OutputMessage {
    return {
        type : "Words",
        command : command,
        words : words
    }
}

export function status(title : string,
                       undoable : boolean,
                       redoable : boolean,
                       properties : Properties) : OutputMessage {
    return {
        type : "Status",
        status : { title, undoable, redoable, properties }
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

export function info(properties : Properties) : OutputMessage {
    return {
        type : "Info",
        properties
    }
}