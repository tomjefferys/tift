import { IdValue } from "tift-engine/src/shared";
import { Word } from "tift-types/src/messages/word";
import { Display, DisplayState } from "./display";
import { EngineFacade } from "./enginefacade";
import { Message } from "./types";
import { createMessage } from "./message";
import { createWordFilter } from "./wordfilter";
import { InputHandler, TabMotion } from "./keypresshandler";

const SPECIAL_PATTERNS : Record<string, string> = {
    "x": "ex" // Allow "x" to match "ex" as a common shorthand for "examine"
}

const filterWords = createWordFilter(SPECIAL_PATTERNS);

export class CommandState implements InputHandler{
    input : string[];
    command : Word[];
    engine : EngineFacade;
    display : Display;
    messages : Message[];
    enterPressed = false;
    selectedWordIndex : number | undefined = undefined;

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
            this.selectedWordIndex = undefined;
        } else if (this.command.length) {
            this.command.pop();
            this.selectedWordIndex = undefined;
        }
    }
    
    enter() {
        this.enterPressed = true;
    }

    tab(direction: TabMotion) {
        const words = filterWords(this.engine.getWords(), this.input).map(word => word.value);

        if(words.length === 0) {
            this.selectedWordIndex = undefined;
            return;
        }

        if (this.selectedWordIndex === undefined) {
            this.selectedWordIndex = (direction === "backward") ? words.length - 1 : 0;
        } else {
            const tabIncrement = direction === "forward" ? 1 : -1;
            const newIndex = this.selectedWordIndex + tabIncrement;
            this.selectedWordIndex = (newIndex < 0)? words.length - 1 : newIndex % words.length;
        }
    }

    update() {
        let selectedWords : Word[] = [];
        if (this.enterPressed && this.selectedWordIndex !== undefined && this.selectedWordIndex >= 0) {
            const selectedWord = filterWords(this.engine.getWords(), this.input)[this.selectedWordIndex];
            selectedWords = [selectedWord];
            this.selectedWordIndex = undefined;
        } else {
            const exactMatch = this.enterPressed;
            selectedWords = filterWords(this.engine.getWords(this.command), this.input, exactMatch);
        }

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
            this.input.length = 0;
            this.selectedWordIndex = undefined;
        }
    
        const displayState = this.getDisplayState();
        this.display.update(displayState);
        this.enterPressed = false;
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
            wordChoices : filterWords(this.engine.getWords(), this.input).map(word => word.value),
            selectedWordIndex
        } 
    }
     
}

function getWords(engine : EngineFacade, state : CommandState) : IdValue<string>[] {
    const matched = engine.getWords(state.command);
    return matched;
}
