import * as readline from "readline";
import * as fs from "fs";
import { CommandState } from "./commandstate";
import { Display } from "./display";
import { createEngine } from "./enginefacade";

readline.emitKeypressEvents(process.stdin);

const display = new Display(process.stdout);
const engine = createEngine();
const data = fs.readFileSync("../example/simple.yaml", "utf8");
engine.load(data);
engine.start();

const commandState = new CommandState(engine, display); 

const stdin = process.stdin;


// without this, we would only get streams once enter is pressed
stdin.setRawMode( true );

// resume stdin in the parent process (node app won't quit all by itself
// unless an error or process.exit() happens)
stdin.resume();

stdin.setEncoding( 'utf8' );

commandState.update();

const letter = /[a-zA-Z]/

stdin.on( 'keypress', (char, event) => {
    if (letter.test(char)) {
        commandState.addChar(char);
    } else if (event.name === "backspace") {
        commandState.backSpace();
    } else if (event.name === "c" && event.ctrl) {
        process.exit();
    }
    commandState.update();
})
