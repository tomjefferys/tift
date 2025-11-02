import { StateManager } from "./statemanager";
import { Result } from "./types";
import { Key } from 'readline';
import * as readline from "readline";

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

            const letter = /[a-zA-Z]/

            const keypressHandler = (char : string, event : Key) => {
                const state = this.stateManager.get();
                if (letter.test(char)) {
                    state.addChar(char);
                } else if (event.name === "backspace") {
                    state.backSpace();
                } else if (event.name === "c" && event.ctrl) {
                    this.readStream.removeListener('keypress', keypressHandler);
                    this.readStream.setRawMode(false);
                    this.readStream.pause();
                    resolve("SUCCESS");
                    return;
                }
                state.update();
            }
            this.readStream.on('keypress', keypressHandler);
        });
    }
}