export type InputMessage = GetWords | Execute | GetStatus | Load | Start | Config | Reset;

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

export interface Reset {
    type : "Reset"
}

export interface Config {
    type : "Config",
    properties : { [key:string]: boolean | number | string }
}

export interface Start {
    type : "Start",
    saveData : string | undefined
}