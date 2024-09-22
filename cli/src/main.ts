import * as readline from "readline";
import * as fs from "fs";
import { CommandState } from "./commandstate";
import { Display } from "./display";
import { createEngine } from "./enginefacade";

readline.emitKeypressEvents(process.stdin);

const display = new Display(process.stdout);
const engine = createEngine();
const stdlib = fs.readFileSync("../resources/stdlib.yaml", "utf8");
const props = fs.readFileSync("../resources/properties.yaml", "utf8");
const data = fs.readFileSync("../examples/CloakOfDarkness/build/adventure.yaml", "utf8");
engine.load(stdlib);
engine.load(props);
engine.load(data);
engine.configure({ "autoLook" : true });

const commandState = new CommandState(engine, display); 

const stdin = process.stdin;


// without this, we would only get streams once enter is pressed
stdin.setRawMode( true );

// resume stdin in the parent process (node app won't quit all by itself
// unless an error or process.exit() happens)
stdin.resume();

stdin.setEncoding( 'utf8' );

engine.start();
commandState.flush();
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
