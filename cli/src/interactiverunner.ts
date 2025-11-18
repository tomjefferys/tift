import { StateManager } from "./statemanager";
import { ControlState } from "./controlstate";
import { Result } from "./types";
import { Key } from 'readline';
import * as readline from "readline";
import { CommandState } from "./commandstate";

type Mode = "GAME" | "CONTROL";

export class InteractiveRunner {
    private stateManager : StateManager;
    private readStream : NodeJS.ReadStream;

    constructor(stateManager : StateManager, readStream : NodeJS.ReadStream = process.stdin) {
        this.stateManager = stateManager;
        this.readStream = readStream;
    }

    async run() : Promise<Result> {
        return new Promise<Result>((resolve) => {

            readline.emitKeypressEvents( this.readStream );

            // without this, we would only get streams once enter is pressed
            this.readStream.setRawMode( true );

            // resume stdin in the parent process (node app won't quit all by itself
            // unless an error or process.exit() happens)
            this.readStream.resume();

            this.readStream.setEncoding( 'utf8' );

            let mode : Mode = "GAME";

            const letter = /[a-zA-Z]/

            let controlState : ControlState | undefined = undefined;
            
            const doQuit = () => {
                this.readStream.removeListener('keypress', keypressHandler);
                this.readStream.setRawMode(false);
                this.readStream.pause();
                resolve("SUCCESS");
            }

            const doRestart = () => {
                this.stateManager.restart();
                mode = "GAME";
                this.stateManager.get().update();
            }

            const doClear = () => {
                const display = controlState?.getDisplay();
                if (display) {
                    display.clearScreen();
                }
                mode = "GAME";
                this.stateManager.get().update();
            }

            const getControlState = () : ControlState => {
                if (!controlState) {
                    const commands : Record<string, () => void> = {
                        "quit": doQuit,
                        "restart": doRestart,
                        "clear": doClear
                    };
                    controlState = this.stateManager.createControlState(commands);
                }
                return controlState;
            }

            const getState : () => ControlState | CommandState = () => {
                return (mode === "GAME")? this.stateManager.get() : getControlState();
            }

            const keypressHandler = (char : string, event : Key) => {
                let state = getState();
                if (char && letter.test(char)) {
                    state.addChar(char);
                } else if (event.name === "backspace") {
                    state.backSpace();
                } else if (event.name === "c" && event.ctrl) {
                    doQuit();
                    return;
                } else if (event.name === "tab") {
                    mode = (mode == "GAME")? "CONTROL" : "GAME";
                    state = getState();
                }

                state.update();
            }
            this.readStream.on('keypress', keypressHandler);
        });
    }
}