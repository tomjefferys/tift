import { blocksToText, parseMarkdown } from "tift-engine";
import { OutputMessage } from "tift-types/src/messages/output";
import { Word } from "tift-types/src/messages/word";
import { StatePersister } from "./statepersister";
import { Message, MessageType, PrintHandler } from "./types";

type WordCache = [Word[], Word[]];

export class MessageConsumer {
    printMessages : Message[] = [];
    wordCache : WordCache = [[],[]];
    status = "";
    statePersister? : StatePersister;
    // The most recent error-level "Log" message (eg a YAML syntax error thrown while
    // loading game data - see BasicEngine.send()'s catch block in engine.ts, which puts
    // the engine into a permanent error state and logs the cause). Only meaningful to
    // check right after a load/initialize - a later, recoverable debug-command error
    // (see debug.ts) would also update this even though the engine isn't fatally errored.
    lastErrorMessage : string | undefined;

    constructor(statePersister? : StatePersister) {
        this.statePersister = statePersister;
    }

    consume(message : OutputMessage) : void {
        switch(message.type) {
            case "Print":
                this.printMessages.push({ type : "Normal", text : blocksToText(message.value), blocks : message.value } );
                break;
            case "Status":
                this.status = message.status["title"];
                break;
            case "Words":
                this.wordCache = [[...message.command], message.words];
                break;
            case "SaveState":
                this.statePersister?.saveState(JSON.stringify(message.state));
                break;
            case "Log":
                if (message.level === "error") {
                    this.lastErrorMessage = message.message;
                }
                this.printMessages.push({
                    type : this.getMessageType(message.level),
                    text : message.message,
                    blocks : parseMarkdown(message.message)
                });
                break;
        }
    }

    private getMessageType(level : string) : MessageType {
        switch(level) {
            case "error":
                return "Error";
            case "warn":
                return "Warning";
            default:
                return "Info";
        }
    }

    flushPrintMessages(messageHandler : PrintHandler) {
        this.printMessages.forEach(messageHandler);
        this.printMessages.length = 0;
    }

}