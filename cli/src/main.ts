#!/usr/bin/env node
import * as readline from "readline";
import * as fs from "fs";
import * as os from "os";
import { parseArgs } from "node:util";
import { CommandState } from "./commandstate";
import { Display } from "./display";
import { createEngine, EngineFacade } from "./enginefacade";
import { isScriptError, ScriptRunner } from "./scriptrunner";
import { getFileStatePersister, getInMemoryStatePersister, StatePersister } from "./statepersister";
import { FileWatcher } from "./filewatcher";

readline.emitKeypressEvents(process.stdin);

interface Options {
    silent : boolean;
    saveFile : string | undefined;
    dataFiles : string[];
}

interface CommandStateRef {
    commandState : CommandState;
}


const options = getCommandLineOptions();

const statePersister = options.saveFile ? getFileStatePersister(options.saveFile) :   getInMemoryStatePersister();

const engineBuilder = () => startEngine(statePersister, options.dataFiles);

if (process.stdin.isTTY) {
   const commandState = buildCommandState(statePersister, options.dataFiles);
   setupFileWatchers(options.dataFiles, () => updateEngineState(commandState, statePersister, options.dataFiles));
   runInteractive(commandState);
} else {
   runBatch(engineBuilder, options);
}


function getCommandLineOptions() : Options {
    const options = { 
        silent : {
            type : "boolean",
            short: "s",
            default : false
        },
        saveFile : {
            type : "string",
            short: "f",
        }
    } as const;

    const args = process.argv.slice(2);

    const { values, positionals } = parseArgs({args, options, allowPositionals : true });

    return {
        silent : values.silent ?? false,
        saveFile : values.saveFile,
        dataFiles : positionals
    }
}

function setupFileWatchers(dataFiles : string[], callback : () => void) {
    dataFiles.forEach((dataFile) => {
        const watcher = new FileWatcher(dataFile, () => {
            console.log(`File changed: ${dataFile}`);
            callback();
        });
        watcher.start();
    });
}

function startEngine(statePersister : StatePersister, dataFiles : string[]) : EngineFacade {

    const engine = createEngine(statePersister);

    dataFiles.forEach((dataFile) => {
        const data = fs.readFileSync(dataFile, "utf8");
        engine.load(data);
    });

    engine.configure({ "autoLook" : true });
    engine.start(statePersister.loadState());

    return engine;
}

function buildCommandState(statePersister : StatePersister, dataFiles : string[]) : CommandStateRef {
    const engine = startEngine(statePersister, dataFiles);
    const display = new Display(process.stdout);
    const commandState = new CommandState(engine, display); 
    commandState.flush();
    commandState.update();
    return { commandState };
}

function updateEngineState(engineState : CommandStateRef, statePersister : StatePersister, dataFiles : string[]) {
    const oldState = engineState.commandState;
    oldState.messages.push("--- Game state reloaded due to file change ---");
    oldState.flush();
    const newState = buildCommandState(statePersister, dataFiles);
    engineState.commandState = newState.commandState;
}

function runInteractive(state : CommandStateRef) {

    const stdin = process.stdin;

    // without this, we would only get streams once enter is pressed
    stdin.setRawMode( true );

    // resume stdin in the parent process (node app won't quit all by itself
    // unless an error or process.exit() happens)
    stdin.resume();

    stdin.setEncoding( 'utf8' );

    const letter = /[a-zA-Z]/

    stdin.on( 'keypress', (char, event) => {
        if (letter.test(char)) {
            state.commandState.addChar(char);
        } else if (event.name === "backspace") {
            state.commandState.backSpace();
        } else if (event.name === "c" && event.ctrl) {
            process.exit();
        }
        state.commandState.update();
    })
}

async function runBatch(engineBuilder : () => EngineFacade, options : Options) {
    const rl = readline.createInterface({
        input: process.stdin,
        crlfDelay: Infinity
    });

    const printFn = options.silent
                        ? (_message : string) => { /* do nothing */ } 
                        : (message : string) => process.stdout.write(message + os.EOL);

    const engine = engineBuilder();

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
