import { Word } from "tift-types/src/messages/word";
import { createWordFilter } from "./wordfilter";
import { InputHandler, TabMotion } from "./keypresshandler";
import { Display, DisplayState } from "./display";

const filterWords = createWordFilter({});

export abstract class BaseInputHandler implements InputHandler {
    protected input: string[] = [];
    protected selectedWordIndex: number | undefined = undefined;
    protected enterPressed = false;
    protected display: Display;

    constructor(display: Display) {
        this.display = display;
    }

    addChar(char: string) {
        this.input.push(char);
        this.selectedWordIndex = undefined; // Clear selection when typing
    }

    backSpace() {
        if (this.input.length) {
            this.input.pop();
            this.selectedWordIndex = undefined;
        } else {
            this.onBackspaceWithEmptyInput();
        }
    }

    enter() {
        this.enterPressed = true;
    }

    tab(direction: TabMotion) {
        const words = this.getFilteredWords();

        if (words.length === 0) {
            this.selectedWordIndex = undefined;
            return;
        }

        if (this.selectedWordIndex === undefined) {
            this.selectedWordIndex = (direction === "backward") ? words.length - 1 : 0;
        } else {
            const tabIncrement = direction === "forward" ? 1 : -1;
            const newIndex = this.selectedWordIndex + tabIncrement;
            this.selectedWordIndex = (newIndex < 0) ? words.length - 1 : newIndex % words.length;
        }
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

        let updateDisplay = true;
        if (execute) {
            updateDisplay = this.execute(selectedWords);
        }
    
        if (updateDisplay) {
            const displayState = this.getDisplayState();
            this.getDisplay().update(displayState);
        }
        this.enterPressed = false;
    }

    getDisplay(): Display {
        return this.display;
    }

    protected getSelectedWord(): Word | undefined {
        if (this.selectedWordIndex !== undefined) {
            const words = this.getFilteredWords();
            return words[this.selectedWordIndex];
        }
        return undefined;
    }

    protected hasSelection(): boolean {
        return this.selectedWordIndex !== undefined;
    }

    protected clearSelection() {
        this.selectedWordIndex = undefined;
    }

    protected clearInput() {
        this.input.length = 0;
        this.selectedWordIndex = undefined;
    }

    protected getFilteredWords(): Word[] {
        return filterWords(this.getAllWords(), this.input);
    }

    protected getFilteredWordsExact(): Word[] {
        return filterWords(this.getAllWords(), this.input, true);
    }

    // Abstract methods that subclasses must implement
    protected abstract getAllWords(): Word[];
    protected abstract onBackspaceWithEmptyInput(): void;
    protected abstract execute(selectedWords: Word[]): boolean;
    protected abstract getDisplayState(): DisplayState;

}