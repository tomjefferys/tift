import { parseMarkdown } from "tift-engine";
import { TextBlock } from "tift-types/src/messages/textblock";
import { Message, MessageType } from "./types";
export type MessageFormatter = (message : Message) => string;

export const createMessage = (text : string, type : MessageType = "Normal") : Message => {
    return { type, text, blocks : parseMarkdown(text) };
}

export class MessageFormatterBuilder {
    private formatters : Map<MessageType, (blocks : TextBlock[]) => string>;

    constructor() {
        this.formatters = new Map<MessageType, (blocks : TextBlock[]) => string>();
    }

    addFormatter(type : MessageType, formatter : (blocks : TextBlock[]) => string) {
        this.formatters.set(type, formatter);
        return this;
    }

    build() : MessageFormatter {
        return (message : Message) => {
            const formatter = this.formatters.get(message.type);
            return formatter ? formatter(message.blocks) : message.text;
        };
    }
}

export const DEFAULT_MESSAGE_FORMATTER : MessageFormatter = new MessageFormatterBuilder().build();