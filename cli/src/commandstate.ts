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
    messages : Message[];
    developerMode : boolean;

    constructor(engine : EngineFacade, display : Display, developerMode = false) {
        super(display);
        this.command = [];
        this.engine = engine;
        this.messages = [];
        this.developerMode = developerMode;
    }

    control(char: string) {
        if (char === "d") {
            this.toggleDeveloperMode();
        }
    }

    toggleDeveloperMode() {
        this.developerMode = !this.developerMode;
    }

    protected onBackspaceWithEmptyInput() {
        if (this.command.length) {
            this.command.pop();
            this.selectedWordIndex = undefined;
        }
    }

    protected getAllWords(): Word[] {
        const allWords =  this.engine.getWords(this.command);
        const debugFiltered = allWords.filter(
            word => this.developerMode ? word.tags?.includes("debug") : !word.tags?.includes("debug"));
        return debugFiltered;
    }

    protected execute(selectedWords : Word[]) : boolean{
        if (selectedWords.length === 0) {
            this.input.pop();
        } else if (selectedWords.length === 1) {
            this.command.push(selectedWords[0]);
            const words = this.getAllWords();
            if (words.length === 0) {
                const commandMessage = createMessage(this.command.map(word => word.value).join(" "), "Command");
                this.messages.push(commandMessage);
                this.engine.execute(this.command.map(word => word.id));
                this.engine.flushMessages(message => this.messages.push(message));
                this.command.length = 0;
            }
            this.clearInput();
        }
        return true;
    }

    flush() {
        this.engine.flushMessages(message => this.messages.push(message));
        this.display.update(this.getDisplayState());
    }

    getDisplayState() : DisplayState {
        const messages = [...this.messages];
        this.messages = [];
        const selectedWordIndex = this.selectedWordIndex; 
        return {
            messages : messages,
            partialCommand : this.command.map(word => word.value),
            partialWord : this.input,
            wordChoices : filterWords(this.getAllWords(), this.input).map(word => word.value),
            selectedWordIndex,
            developer : this.developerMode
        }
    }
     
}
