import { Key } from 'readline';

type Mode = "GAME" | "CONTROL";

export interface InputHandler {
    addChar(char: string): void;
    backSpace(): void;
    enter(): void;
    update(): void;
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
        
        if (char && this.letter.test(char)) {
            state.addChar(char);
        } else if (event.name === "return") {
            state.enter();  
        } else if (event.name === "backspace") {
            state.backSpace();
        } else if (event.name === "c" && event.ctrl) {
            this.dependencies.onQuit();
            return;
        } else if (event.name === "tab") {
            this.mode = (this.mode === "GAME") ? "CONTROL" : "GAME";
            state = this.getCurrentState();
        }

        state.update();
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