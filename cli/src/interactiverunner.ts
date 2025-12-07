import { StateManager } from "./statemanager";
import { ControlState } from "./controlstate";
import { Result } from "./types";
import * as readline from "readline";
import { KeypressHandler, KeypressHandlerDependencies } from "./keypresshandler";

export class InteractiveRunner {
    private stateManager : StateManager;
    private readStream : NodeJS.ReadStream;
    private keypressHandler: KeypressHandler;

    constructor(stateManager : StateManager, readStream : NodeJS.ReadStream = process.stdin) {
        this.stateManager = stateManager;
        this.readStream = readStream;
        this.keypressHandler = this.createKeypressHandler();
    }

    private createKeypressHandler(): KeypressHandler {
        let controlState: ControlState | undefined = undefined;

        const doQuit = () => {
            this.cleanup();
        }

        const doRestart = () => {
            this.stateManager.restart();
            this.keypressHandler.setMode("GAME");
            this.stateManager.get().update();
        }

        const doClear = () => {
            const display = controlState?.getDisplay();
            if (display) {
                display.clearScreen();
            }
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

        const dependencies: KeypressHandlerDependencies = {
            getGameState: () => this.stateManager.get(),
            getControlState: getControlState,
            onQuit: doQuit
        };

        return new KeypressHandler(dependencies);
    }

    async run() : Promise<Result> {
        return new Promise<Result>((resolve) => {
            readline.emitKeypressEvents(this.readStream);

            // without this, we would only get streams once enter is pressed
            this.readStream.setRawMode(true);

            // resume stdin in the parent process (node app won't quit all by itself
            // unless an error or process.exit() happens)
            this.readStream.resume();

            this.readStream.setEncoding('utf8');

            // Store the resolve function so cleanup can call it
            this.resolvePromise = resolve;

            this.readStream.on('keypress', this.keypressHandler.handleKeypress);
        });
    }

    private resolvePromise?: (value: Result) => void;

    private cleanup() {
        this.readStream.removeListener('keypress', this.keypressHandler.handleKeypress);
        this.readStream.setRawMode(false);
        this.readStream.pause();
        if (this.resolvePromise) {
            this.resolvePromise("SUCCESS");
        }
    }
}