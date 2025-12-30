export type MessageType = "Normal" | "Command" | "Info" | "Warning" | "Error";
export interface Message {
    type : MessageType,
    text : string
}
export type PrintHandler = (message : Message) => void;
export type Result = "SUCCESS" | "FAILURE";