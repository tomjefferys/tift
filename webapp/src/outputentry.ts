
export type OutputEntry = Message | Command

export interface Message {
    type : "message";
    message : string;
}

export interface Command {
    type : "command";
    command : string;
}

export function message(message : string) : OutputEntry {
    return {
        type : "message",
        message : message
    };
}

export function command(command : string) : OutputEntry {
    return {
        type : "command",
        command : command
    }
}