import * as readline from "readline";
import * as fs from "fs";
import * as os from "os";
import { parseArgs } from "node:util";
import { CommandState } from "./commandstate";
import { Display } from "./display";
import { createEngine } from "./enginefacade";
import { isScriptError, ScriptRunner } from "./scriptrunner";

readline.emitKeypressEvents(process.stdin);


const options = { 
    silent : {
        type : "boolean",
        short: "s",
        default : false
    },
} as const;

const args = process.argv.slice(2);

const { values, positionals } = parseArgs({args, options, allowPositionals : true });

const engine = createEngine();

positionals.forEach((positional) => {
    const data = fs.readFileSync(positional, "utf8");
    engine.load(data);
});

engine.configure({ "autoLook" : true });
engine.start();

if (process.stdin.isTTY) {
   runInteractive();
} else {
   runBatch();
}


function runInteractive() {
    const display = new Display(process.stdout);
    const commandState = new CommandState(engine, display); 

    const stdin = process.stdin;

    // without this, we would only get streams once enter is pressed
    stdin.setRawMode( true );

    // resume stdin in the parent process (node app won't quit all by itself
    // unless an error or process.exit() happens)
    stdin.resume();

    stdin.setEncoding( 'utf8' );

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
}

async function runBatch() {
    const rl = readline.createInterface({
        input: process.stdin,
        crlfDelay: Infinity
    });

    const printFn = values.silent
                        ? (_message : string) => { /* do nothing */ } 
                        : (message : string) => process.stdout.write(message + os.EOL);

    const scriptRunner = new ScriptRunner(engine, printFn);

    scriptRunner.flushOutput();
    let lineNum = 1;
    for await (const line of rl) {
        try {
            scriptRunner.executeLine(line);
        } catch (e) {
            const err = (message : string) => process.stderr.write(message + os.EOL);
            err(`Failed on line ${lineNum}: ${line}`);
            if (isScriptError(e)) {
                err("");
                if (e.output.length > 0) {
                    e.output.forEach(message => err(message));
                }
                err("");
                err(`${e.message}`);
                process.exit(1);
            } else {
                throw e;
            }
        }
        lineNum++;
    }
    process.exit(0);
}
