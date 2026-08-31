#!/usr/bin/env node
import * as readline from "readline";
import * as os from "os";
import { getCommandLineOptions, Options } from "./clioptions";
import { Display } from "./display";
import { createEngine } from "./enginefacade";
import { ScriptRunner } from "./scriptrunner";
import { getFileStatePersister, getInMemoryStatePersister, StatePersister } from "./statepersister";
import { FileWatcher } from "./filewatcher";
import { StateManager } from "./statemanager";
import { InteractiveRunner } from "./interactiverunner";
import { Result } from "./types";
import { getANSIMarkdownMessageFormatter } from "./ansimessageformatter";
import { getAlignedANSICommandFormatter, getAlignedANSIWordsFormatter } from "./displayformatters";
import { getTokenAligner } from "./textaligner";
import { ANSI_TOKEN_FORMATTER } from "./tokenformatter";

async function main() {

    const options = getCommandLineOptions(process.argv.slice(2));
    const statePersister = options.saveFile ? getFileStatePersister(options.saveFile) :   getInMemoryStatePersister();

    let result = "SUCCESS";
    if (process.stdin.isTTY) {
        result = await runInteractive(statePersister, options);
    } else {
        result = await runBatch(statePersister, options);
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
        const consoleWidth = process.stdout.columns || 80;
        const tokenListFormatter = getTokenAligner(consoleWidth, 75, ANSI_TOKEN_FORMATTER);
        const ansiMessageFormatter = getANSIMarkdownMessageFormatter(tokenListFormatter);
        const commandFormatter = getAlignedANSICommandFormatter(tokenListFormatter);
        const wordsFormatter = getAlignedANSIWordsFormatter(tokenListFormatter);
        
        const stateManager = new StateManager(
            statePersister,
            options.dataFiles,
            () => new Display(process.stdout, ansiMessageFormatter, commandFormatter, wordsFormatter),
            options.developer,
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

async function runBatch(statePersister : StatePersister, options : Options) : Promise<Result> {
    const printFn = options.silent
                        ? (_message : string) => { /* do nothing */ }
                        : (message : string) => process.stdout.write(message + os.EOL);

    const errorFn = (message : string) => process.stderr.write(message + os.EOL);

    const lineGenerator = createLineGenerator();
    const getNextLine = async () => {
        const result = await lineGenerator.next();
        return result.done ? null : result.value;
    }

    const engine = createEngine(statePersister, options.dataFiles);
    // A "---" script line restarts the game from scratch (deleting any persisted save
    // state first), so each test section starts from a clean slate - see scriptrunner.ts.
    const restartEngine = () => {
        statePersister.deleteState();
        return createEngine(statePersister, options.dataFiles);
    }

    const scriptRunner = new ScriptRunner(engine, printFn, errorFn, restartEngine);
    return await scriptRunner.run(getNextLine);
}

main().catch((error) => {
    console.error('Error in main:', error);
    process.exit(1);
});
