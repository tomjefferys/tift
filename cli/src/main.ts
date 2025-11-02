#!/usr/bin/env node
import * as readline from "readline";
import * as os from "os";
import { getCommandLineOptions, Options } from "./clioptions";
import { Display } from "./display";
import { createEngine, EngineFacade } from "./enginefacade";
import { ScriptRunner } from "./scriptrunner";
import { getFileStatePersister, getInMemoryStatePersister, StatePersister } from "./statepersister";
import { FileWatcher } from "./filewatcher";
import { StateManager } from "./statemanager";
import { InteractiveRunner } from "./interactiverunner";
import { Result } from "./types";
import { ANSI_MESSAGE_FORMATTER } from "./ansimessageforamtter";

async function main() {

    const options = getCommandLineOptions(process.argv.slice(2));
    const statePersister = options.saveFile ? getFileStatePersister(options.saveFile) :   getInMemoryStatePersister();

    let result = "SUCCESS";
    if (process.stdin.isTTY) {
        result = await runInteractive(statePersister, options);
    } else {
        const engine = createEngine(statePersister, options.dataFiles);
        result = await runBatch(engine, options);
    }
    process.exit(result === "SUCCESS" ? 0 : 1);
}


function setupFileWatchers(dataFiles : string[], callback : () => void) : FileWatcher[] {
    return dataFiles.map((dataFile) => {
        const watcher = new FileWatcher(dataFile, () => {
            console.log(`File changed: ${dataFile}`);
            callback();
        });
        watcher.start();
        return watcher;
    });
}

async function* createLineGenerator() {
    const rl = readline.createInterface({
        input: process.stdin,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        yield line;
    }
}

async function runInteractive(statePersister : StatePersister,
                              options : Options) : Promise<Result> {
    let watchers : FileWatcher[] = [];
    try {
        const stateManager = new StateManager(
            statePersister,
            options.dataFiles,
            () => new Display(process.stdout, ANSI_MESSAGE_FORMATTER)
        );
        watchers = setupFileWatchers(options.dataFiles, () => stateManager.refresh());
        const interactiveRunner = new InteractiveRunner(stateManager);
        const result = await interactiveRunner.run();
        return result;
    } finally {
        // Clean up file watchers
        watchers.forEach(watcher => watcher.stop());
    }
}

async function runBatch(engine : EngineFacade, options : Options) : Promise<Result> {
    const printFn = options.silent
                        ? (_message : string) => { /* do nothing */ } 
                        : (message : string) => process.stdout.write(message + os.EOL);

    const errorFn = (message : string) => process.stderr.write(message + os.EOL);

    const lineGenerator = createLineGenerator();
    const getNextLine = async () => {
        const result = await lineGenerator.next();
        return result.done ? null : result.value;
    }

    const scriptRunner = new ScriptRunner(engine, printFn, errorFn);
    return await scriptRunner.run(getNextLine);
}

main().catch((error) => {
    console.error('Error in main:', error);
    process.exit(1);
});
