import { Display, DisplayState } from "./display";
import { InputHandler, TabMotion } from "./keypresshandler";
import { createWordFilter } from "./wordfilter";
import { Word } from "tift-types/src/messages/word";

const filterWords = createWordFilter({});

export class ControlState implements InputHandler {
    private display : Display;
    private input : string[] = [];
    private commands : Record<string, () => void>;
    private enterPressed = false;
    
    constructor(display : Display, commands : Record<string, () => void>) {
        this.display = display;
        this.commands = commands;
    }

    addChar(char : string) {
        this.input.push(char);
    }

    backSpace() {
        if (this.input.length) {
            this.input.pop();
        }
    }

    enter() {
        this.enterPressed = true;
    }

    tab(_direction: TabMotion) {
        //  TODO
    }

    update() {
        if (this.input.length > 0) {
            const exactMatch = this.enterPressed;
            const commandWords = filterWords(this.getAllWords(), this.input, exactMatch);
            if (commandWords.length === 0) {
                this.input.pop();
            } else if (commandWords.length === 1) {
                this.commands[commandWords[0].value]();
                this.input.length = 0;
                return;
            }
        }
        const displayState = this.getDisplayState();
        this.display.update(displayState);
        this.enterPressed = false;
    }

    getDisplay() : Display {
        return this.display;
    }

    private getDisplayState() : DisplayState {
        const allWords = this.getAllWords();
        return {
            partialCommand: [],
            partialWord: this.input,
            wordChoices: filterWords(allWords, this.input).map(word => word.value),
            messages: []
        };
    }

    private getAllWords() : Word[] {
        return Object.keys(this.commands).map(key => ({ type : "option", id : key, value: key }));
    }
}