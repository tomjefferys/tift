import { ControlType } from "./controltype";
import { IdValue, Taggable } from "../shared";
import { History } from "../util/historyproxy";

export type OutputMessage = Print | SetVar | Look | Words | Status | SaveState | Log | Control

export type OutputConsumer = (message : OutputMessage) => void;

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

export type WordType = "word" | "option" | "control" | "select";

export type PoSType = "start" | "verb" | "directObject" | "preposition" | "indirectObject" | "modifier";

type Not<T,R> = R extends T ? never : R;

export type StatusType = {
    title : string, 
    undoable : boolean,
    redoable : boolean
}

export type Word = OptionWord | ControlWord | SelectWord | PartOfSpeech;

export interface OptionWord extends IdValue<string>, Partial<Taggable> {
    type : "option";
}

export interface ControlWord extends IdValue<string>, Partial<Taggable> {
    type : "control";
}

export interface SelectWord extends IdValue<string>, Partial<Taggable> {
    type : "select";
}

export interface PartOfSpeech extends IdValue<string>, Partial<Taggable> {
    type : "word";
    partOfSpeech : PoSType
    modifierType? : string;
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
    command : string[],
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