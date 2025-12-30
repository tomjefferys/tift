import { getEngine, Input } from "tift-engine";
import { Engine } from "tift-types/src/engine";
import * as _ from "lodash"
import { Word } from "tift-types/src/messages/word";
import { StatePersister } from "./statepersister";
import * as fs from "fs";
import { MessageConsumer } from "./messageconsumer";
import { PrintHandler } from "./types";

export type EngineFactory = (statePersister : StatePersister, dataFiles : string[]) => EngineFacade;

export const createEngine : EngineFactory = (statePersister : StatePersister, dataFiles : string[]) => {
    const messageConsumer = new MessageConsumer(statePersister);
    const engine = new EngineFacade(messageConsumer, getEngine(message => messageConsumer.consume(message)));
    engine.initialize(statePersister, dataFiles);
    return engine;
}
export class EngineFacade {
    private engine : Engine;

    private messageConsumer : MessageConsumer;

    constructor(messageConsumer : MessageConsumer, engine : Engine) {
        this.engine = engine;
        this.messageConsumer = messageConsumer;
    }

    initialize(statePersister : StatePersister, dataFiles : string[]) {
        dataFiles.forEach((dataFile) => {
            const data = fs.readFileSync(dataFile, "utf8");
            this.load(data);
        });

        this.configure({ "autoLook" : true });
        this.start(statePersister.loadState());
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