export type OutputEntry = Message | Command

export interface Message {
    type : "message";
    message : string;
}

export interface Command {
    type : "command";
    command : string;
}

export function messageEntry(message : string) : OutputEntry {
    return { type : "message", message };
}

export function commandEntry(command : string) : OutputEntry {
    return { type : "command", command }
}