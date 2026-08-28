import { TextBlock } from "tift-types/src/messages/textblock";

export type OutputEntry = Message | Command | Log

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace"

export interface Message {
    type : "message";
    // `string` is only possible here for scroll-back persisted before the
    // structured TextBlock[] format was introduced - see BlockRenderer's
    // legacy-string handling in Output.tsx.
    message : TextBlock[] | string;
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

export function messageEntry(message : TextBlock[]) : OutputEntry {
    return { type : "message", message };
}

export function commandEntry(command : string[], cursor : number) : Command {
    return { type : "command", command, cursor}
}

export function logEntry(level : LogLevel, message : string) : OutputEntry {
    return { type : "log", level, message };
}