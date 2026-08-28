import { TextBlock } from "tift-types/src/messages/textblock";

export type MessageType = "Normal" | "Command" | "Info" | "Warning" | "Error";
export interface Message {
    type : MessageType,
    // Plain-text projection, used for scripted-test substring matching
    // (ScriptRunner) and batch/--silent output.
    text : string,
    // Structured form, used for interactive ANSI rendering (ansimessageformatter.ts).
    blocks : TextBlock[]
}
export type PrintHandler = (message : Message) => void;
export type Result = "SUCCESS" | "FAILURE";