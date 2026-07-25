import { Word } from "./word";

export type InputMessage = GetWords | Execute | GetStatus | Save | Load | Start | Config | Reset | Undo | Redo | GetInfo | Validate;

export type InputMessageType = InputMessage["type"];

export type ConfigProperties = { [key:string]: boolean | number | string };

export interface GetWords {
    type : "GetWords",
    command : Word[]
}

export interface Execute {
    type : "Execute",
    command : string[]
}

export interface GetStatus {
    type : "GetStatus"
}

export interface Load {
    type : "Load",
    data : string
}

export interface Save {
    type : "Save"
    compress : boolean
}

export interface Reset {
    type : "Reset"
}

export interface Undo {
    type : "Undo"
}

export interface Redo {
    type : "Redo"
}

export interface Config {
    type : "Config",
    properties : ConfigProperties
}

export interface Start {
    type : "Start",
    saveData : string | undefined
}

export interface GetInfo {
    type : "GetInfo";
}

/**
 * Validates game data without loading it into the running engine.
 * Does not mutate any engine state, and works even after the engine has errored.
 */
export interface Validate {
    type : "Validate",
    data : string
}