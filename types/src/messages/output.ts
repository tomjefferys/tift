import { ControlType } from "./controltype";
import { History } from "../util/historyproxy";
import { Word } from "./word";

export type OutputMessage = Print | SetVar | Look | Words | Status | SaveState | Log | Control

export type OutputConsumer = (message : OutputMessage) => void;

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

export type WordType = "word" | "option" | "control" | "select";


type Not<T,R> = R extends T ? never : R;

export type StatusProperties = {[key:string]:any};

export type StatusType = {
    title : string, 
    undoable : boolean,
    redoable : boolean,
    properties : StatusProperties
}


export interface Print {
    type : "Print",
    value : string,
    tag? : string
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
    command : Word[],
    words : Word[]
}

export interface Status {
    type : "Status",
    status : StatusType
}

/**
 * A control message, to indicate the client should take some action
 */
export interface Control {
    type : "Control",
    value : ControlType
}

export interface Log {
    type : "Log", 
    level : LogLevel,
    message : string
}

export interface SaveState {
    type : "SaveState",
    state : History
}