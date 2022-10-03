export type InputMessage = GetWords | Execute | GetStatus | Load | Start;

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

export interface Start {
    type : "Start"
}