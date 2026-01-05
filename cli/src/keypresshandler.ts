import { Key } from 'readline';

type Mode = "GAME" | "CONTROL";

export type TabMotion = "forward" | "backward";

export interface InputHandler {
    addChar(char: string): void;
    control(char: string): void;
    backSpace(): void;
    enter(): void;
    update(execute: boolean): void;
    tab(direction: TabMotion): void;
}

export interface KeypressHandlerDependencies {
    getGameState(): InputHandler;
    getControlState(): InputHandler;
    onQuit(): void;
}

export class KeypressHandler {
    private mode: Mode = "GAME";
    private dependencies: KeypressHandlerDependencies;
    private letter = /[a-zA-Z ]/;

    constructor(dependencies: KeypressHandlerDependencies) {
        this.dependencies = dependencies;
    }

    handleKeypress = (char: string, event: Key): void => {
        let state = this.getCurrentState();
        
        let execute = true;

        if (char && this.letter.test(char)) {
            state.addChar(char);
        } else if (event.name === "return") {
            state.enter();  
        } else if (event.name === "backspace") {
            state.backSpace();
            execute = false;
        } else if (event.name === "c" && event.ctrl) {
            this.dependencies.onQuit();
            return;
        } else if (event.name === "tab") {
            const direction = event.shift ? "backward" : "forward";
            state.tab(direction);
            execute = false;
        } else if (event.name === "l" && event.ctrl) {
            this.mode = (this.mode === "GAME") ? "CONTROL" : "GAME";
            state = this.getCurrentState();
            execute = false;
        } else if (event.name && event.ctrl) {
            state.control(event.name);
            execute = false;
        }

        state.update(execute);
    }

    getCurrentMode(): Mode {
        return this.mode;
    }

    setMode(mode: Mode): void {
        this.mode = mode;
    }

    private getCurrentState(): InputHandler {
        return (this.mode === "GAME") 
            ? this.dependencies.getGameState() 
            : this.dependencies.getControlState();
    }
}