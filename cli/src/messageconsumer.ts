import { OutputMessage } from "tift-types/src/messages/output";
import { Word } from "tift-types/src/messages/word";
import { StatePersister } from "./statepersister";
import { PrintHandler } from "./types";

type WordCache = [Word[], Word[]];

export class MessageConsumer {
    printMessages : string[] = [];
    wordCache : WordCache = [[],[]];
    status = "";
    statePersister? : StatePersister;

    constructor(statePersister? : StatePersister) {
        this.statePersister = statePersister;
    }

    consume(message : OutputMessage) : void {
        switch(message.type) {
            case "Print":
                this.printMessages.push(message.value);
                break;
            case "Status":
                this.status = message.status["title"];
                break;
            case "Words":
                this.wordCache = [[...message.command], message.words];
                break;
            case "SaveState":
                this.statePersister?.saveState(JSON.stringify(message.state));
        }
    }

    flushPrintMessages(messageHandler : PrintHandler) {
        this.printMessages.forEach(messageHandler);
        this.printMessages.length = 0;
    }

}