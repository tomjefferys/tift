export type InputMessage = GetWords | Execute | GetStatus | Load /*| LoadSave*/ | Start | Config;

export interface GetWords {
    type : "GetWords",
    command : string[]
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

// TODO don't reuse the word Load
//export interface LoadSave {
//    type : "LoadSave",
//    data : string
//}

export interface Config {
    type : "Config",
    properties : { [key:string]: boolean | number | string }
}

export interface Start {
    type : "Start",
    saveData : string | undefined
}