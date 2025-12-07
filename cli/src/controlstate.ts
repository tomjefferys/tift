import { Display, DisplayState } from "./display";
import { Word } from "tift-types/src/messages/word";
import { BaseInputHandler } from "./baseinputhandler";

export class ControlState extends BaseInputHandler {
    private display : Display;
    private commands : Record<string, () => void>;
    
    constructor(display : Display, commands : Record<string, () => void>) {
        super();
        this.display = display;
        this.commands = commands;
    }

    protected onBackspaceWithEmptyInput() {
        // No special behavior needed for control state
    }

    protected getAllWords() : Word[] {
        return Object.keys(this.commands).map(key => ({ type : "option", id : key, value: key }));
    }

    update() {
        if (this.enterPressed && this.selectedWordIndex !== undefined) {
            // User has selected a specific command with tab and pressed enter
            const selectedWord = this.getFilteredWords()[this.selectedWordIndex];
            this.commands[selectedWord.value]();
            this.clearInput();
            return;
        }

        if (this.input.length > 0) {
            const exactMatch = this.enterPressed;
            const commandWords = exactMatch ? this.getFilteredWordsExact() : this.getFilteredWords();
            if (commandWords.length === 0) {
                this.input.pop();
            } else if (commandWords.length === 1) {
                this.commands[commandWords[0].value]();
                this.clearInput();
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
        return {
            partialCommand: [],
            partialWord: this.input,
            wordChoices: this.getFilteredWords().map(word => word.value),
            selectedWordIndex: this.selectedWordIndex,
            messages: []
        };
    }
}