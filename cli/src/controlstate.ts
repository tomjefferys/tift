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

    protected execute(selectedWords : Word[]): boolean {
        let updateDisplay = true;
        if (selectedWords.length === 0) {
            this.input.pop();
        } else if (selectedWords.length === 1) {
            this.commands[selectedWords[0].value]();
            this.clearInput();
            updateDisplay = false;
        }
        return updateDisplay;
    }

    getDisplay() : Display {
        return this.display;
    }

    protected getDisplayState() : DisplayState {
        return {
            partialCommand: [],
            partialWord: this.input,
            wordChoices: this.getFilteredWords().map(word => word.value),
            selectedWordIndex: this.selectedWordIndex,
            messages: []
        };
    }
}