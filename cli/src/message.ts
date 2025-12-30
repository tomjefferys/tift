import { Message, MessageType } from "./types";
export type MessageFormatter = (message : Message) => string;

export const createMessage = (text : string, type : MessageType = "Normal") : Message => {
    return { type, text };
}

export class MessageFormatterBuilder {
    private formatters : Map<MessageType, (text : string) => string>;

    constructor() {
        this.formatters = new Map<MessageType, (text : string) => string>();
    }

    addFormatter(type : MessageType, formatter : (text : string) => string) {
        this.formatters.set(type, formatter);
        return this;
    }

    build() : MessageFormatter {
        return (message : Message) => {
            const formatter = this.formatters.get(message.type);
            return formatter ? formatter(message.text) : message.text;
        };
    }
}

export const DEFAULT_MESSAGE_FORMATTER : MessageFormatter = new MessageFormatterBuilder().build();