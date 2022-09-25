import { IdValue } from "tift-engine/src/shared";
import { Display, DisplayState } from "./display";
import { EngineFacade } from "./enginefacade";

export class CommandState {
    input : string[];
    command : IdValue<string>[];
    engine : EngineFacade;
    display : Display;
    messages : string[];

    constructor(engine : EngineFacade, display : Display) {
        this.input = [];
        this.command = [];
        this.engine = engine;
        this.display = display;
        this.messages = [];
    }

    addChar(char : string) {
        this.input.push(char);
    }

    backSpace() {
        if (this.input.length) {
            this.input.pop();
        } else if (this.command.length) {
            this.command.pop();
        }
    }

    update() {
        const filtered = filterWords(this.engine.getWords(this.command.map(word => word.id)), this.input);
        if (filtered.length === 0) {
            this.input.pop();
        } else if (filtered.length === 1) {
            this.command.push(filtered[0]);
            const words = getWords(this.engine, this);
            if (words.length === 0) {
                this.messages.push(this.command.map(word => word.value).join(" "));
                this.engine.execute(this.command.map(word => word.id));
                this.engine.flushMessages(message => this.messages.push(message));
                this.command.length = 0;
            }
            this.input.length = 0;
        }
    
        const displayState = this.getDisplayState();
        this.display.update(displayState);
    }

    printStatus() {
        const status = this.engine.getStatus();
        this.display.printLine(status + "\n");
    }

    getDisplayState() : DisplayState {
        const messages = [...this.messages];
        this.messages = [];
        return {
            messages : messages,
            partialCommand : this.command.map(word => word.value), 
            partialWord : this.input,
            wordChoices : filterWords(this.engine.getWords(), this.input).map(word => word.value)
        } 
    }
     
}

function getWords(engine : EngineFacade, state : CommandState) : IdValue<string>[] {
    const wordIds = state.command.map(word => word.id);
    const matched = engine.getWords(wordIds);
    return matched;
}

export function filterWords(words : IdValue<string>[], prefixChars : string[]) {
    const prefix = prefixChars.join("");
    return words.filter(word => word.value.startsWith(prefix));
}
