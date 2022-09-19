import { getEngine } from "tift-engine"
import { Engine } from "tift-engine/src/engine";
import * as _ from "lodash"
import { IdValue } from "tift-engine/src/shared";
import { OutputMessage } from "tift-engine/src/messages/output";

type WordCache = [string[], IdValue<string>[]];
type MessageHandler = (message : OutputMessage) => void;

export function createEngine() : EngineFacade {
    const messages : OutputMessage[] = [];
    return new EngineFacade(getEngine(message => messages.push(message)), messages);
}

export class EngineFacade {
    private engine : Engine;

    private wordCache : WordCache;
    private messages : OutputMessage[];

    constructor(engine : Engine, messages : OutputMessage[]) {
        this.engine = engine;
        this.messages = messages;
        this.wordCache = [[], this.engine.getWords([])];
    }

    getWords(command : string[] = this.wordCache[0]) {
        let [partial, words] = this.wordCache;
        if (!_.isEqual(command, partial)) {
            this.updateWordCache(command);
            [partial, words] = this.wordCache;
        }
        return words;
    }
    
    execute(command : string[]) {
        this.engine.execute(command);
        this.updateWordCache([]);
    }

    getStatus() : string {
        return this.engine.getStatus();
    }
    
    flushMessages(messageHandler : MessageHandler) {
        this.messages.forEach(messageHandler);
        this.messages.length = 0;
    }

    private updateWordCache(command : string[]) {
        this.wordCache = [command, this.engine.getWords(command)];
    }
}
