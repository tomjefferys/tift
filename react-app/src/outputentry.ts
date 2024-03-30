export type OutputEntry = Message | Command | Log

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace"

export interface Message {
    type : "message";
    message : string;
}

export interface Command {
    type : "command";
    command : string[];
    cursor : number;
}

export interface Log {
    type : "log";
    level : LogLevel,
    message : string
}

export function messageEntry(message : string) : OutputEntry {
    return { type : "message", message };
}

export function commandEntry(command : string[], cursor : number) : Command {
    return { type : "command", command, cursor}
}

export function logEntry(level : LogLevel, message : string) : OutputEntry {
    return { type : "log", level, message };
}