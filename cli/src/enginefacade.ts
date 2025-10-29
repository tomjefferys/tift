import { getEngine, Input } from "tift-engine";
import { Engine } from "tift-types/src/engine";
import * as _ from "lodash"
import { OutputMessage } from "tift-types/src/messages/output";
import { Word } from "tift-types/src/messages/word";
import { StatePersister } from "./statepersister";

type WordCache = [Word[], Word[]];
type PrintHandler = (message : string) => void;

export function createEngine(StatePersister : StatePersister) : EngineFacade {
    const messageConsumer = new MessageConsumer(StatePersister);
    return new EngineFacade(messageConsumer, getEngine(message => messageConsumer.consume(message)));
}

export class EngineFacade {
    private engine : Engine;

    private messageConsumer : MessageConsumer;

    constructor(messageConsumer : MessageConsumer, engine : Engine) {
        this.engine = engine;
        this.messageConsumer = messageConsumer;
    }

    getWords(command : Word[] = this.messageConsumer.wordCache[0]) : Word[] {
        let [partial, words] = this.messageConsumer.wordCache;
        if (!_.isEqual(command.map(word => word.id), partial.map(word => word.id))) {
            this.engine.send(Input.getNextWords(command));
            [partial, words] = this.messageConsumer.wordCache;
        }
        return words;
    }
    
    execute(command : string[]) {
        this.engine.send(Input.execute(command));
        this.engine.send(Input.getNextWords([]));
    }

    getStatus() : string {
        return this.messageConsumer.status;
    }

    load(data : string) {
        this.engine.send(Input.load(data));
    }

    configure(properties : {[key:string] : boolean | number | string}) {
        this.engine.send(Input.config(properties));
    }

    start(saveData? : string) {
        this.engine.send(Input.start(saveData));
        this.engine.send(Input.getStatus());
        this.engine.send(Input.getNextWords([]));
    }
    
    flushMessages(printHandler : PrintHandler) {
        this.messageConsumer.flushPrintMessages(printHandler);
    }
}


class MessageConsumer {
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
