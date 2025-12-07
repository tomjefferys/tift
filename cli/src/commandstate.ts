import { IdValue } from "tift-engine/src/shared";
import { Word } from "tift-types/src/messages/word";
import { Display, DisplayState } from "./display";
import { EngineFacade } from "./enginefacade";
import { Message } from "./types";
import { createMessage } from "./message";
import { createWordFilter } from "./wordfilter";
import { BaseInputHandler } from "./baseinputhandler";

const SPECIAL_PATTERNS : Record<string, string> = {
    "x": "ex" // Allow "x" to match "ex" as a common shorthand for "examine"
}

const filterWords = createWordFilter(SPECIAL_PATTERNS);

export class CommandState extends BaseInputHandler {
    command : Word[];
    engine : EngineFacade;
    display : Display;
    messages : Message[];

    constructor(engine : EngineFacade, display : Display) {
        super();
        this.command = [];
        this.engine = engine;
        this.display = display;
        this.messages = [];
    }

    protected onBackspaceWithEmptyInput() {
        if (this.command.length) {
            this.command.pop();
            this.selectedWordIndex = undefined;
        }
    }

    protected getAllWords(): Word[] {
        return this.engine.getWords(this.command);
    }

    update(execute : boolean) {
        let selectedWords : Word[] = [];
        if (this.enterPressed && this.selectedWordIndex !== undefined) {
            const selectedWord = this.getFilteredWords()[this.selectedWordIndex];
            selectedWords = [selectedWord];
            this.selectedWordIndex = undefined;
        } else {
            const exactMatch = this.enterPressed;
            selectedWords = exactMatch ? this.getFilteredWordsExact() : this.getFilteredWords();
        }

        if (execute) {
            this.executeCommand(selectedWords);
        }
    
        const displayState = this.getDisplayState();
        this.display.update(displayState);
        this.enterPressed = false;
    }

    private executeCommand(selectedWords : Word[]) {
        if (selectedWords.length === 0) {
            this.input.pop();
        } else if (selectedWords.length === 1) {
            this.command.push(selectedWords[0]);
            const words = getWords(this.engine, this);
            if (words.length === 0) {
                const commandMessage = createMessage(this.command.map(word => word.value).join(" "), "Command");
                this.messages.push(commandMessage);
                this.engine.execute(this.command.map(word => word.id));
                this.engine.flushMessages(message => this.messages.push(message));
                this.command.length = 0;
            }
            this.clearInput();
        }
    }

    flush() {
        this.engine.flushMessages(message => this.messages.push(message));
        this.display.update(this.getDisplayState());
    }

    printStatus() {
        const status = this.engine.getStatus();
        this.display.printLine(status + "\n");
    }

    getDisplayState() : DisplayState {
        const messages = [...this.messages];
        this.messages = [];
        const selectedWordIndex = this.selectedWordIndex; 
        return {
            messages : messages,
            partialCommand : this.command.map(word => word.value), 
            partialWord : this.input,
            wordChoices : filterWords(this.engine.getWords(this.command), this.input).map(word => word.value),
            selectedWordIndex
        } 
    }
     
}

function getWords(engine : EngineFacade, state : CommandState) : IdValue<string>[] {
    const matched = engine.getWords(state.command);
    return matched;
}
