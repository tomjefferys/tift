export type InputMessage = GetWords | Execute | GetStatus;

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

export function getNextWords(command : string[]) : InputMessage {
    return {
        type : "GetWords",
        command : command
    };
}

export function execute(command : string[]) : InputMessage {
    return {
        type : "Execute",
        command : command
    }
}

export function getStatus() : InputMessage {
    return {
        type : "GetStatus"
    }
}