import { Word } from "tift-types/src/messages/word";
import { EngineFacade } from "./enginefacade";
import { Result } from "./types";

export type PrintFn = (message : string) => void;



export class ScriptError extends Error {
    output : string[];

    constructor(output : string[], message : string) {
        super(message);
        this.output = output;
    }
}

export function isScriptError(error : unknown) : error is ScriptError {
    return error instanceof ScriptError;
}

// The id of the sandbox room created by "--- sandbox" (see enterSandbox()).
const SANDBOX_ROOM_ID = "__sandbox__";

// A minimal, empty room, loaded on demand by "--- sandbox" so a section can test a
// single item in isolation, unaffected by whatever else is going on in the rest of
// the game.
const SANDBOX_ROOM_YAML = `
room: ${SANDBOX_ROOM_ID}
name: Sandbox
description: An empty room, used to isolate an item for testing.
`;

// Runs a script line by line and checks the output
// against the expected messages
// Lines starting with a "$" are commands
// Lines starting with a ">" are developer commands (eg teleport, get, drop - see
// engine/src/debug.ts), used to set up scenarios that would be awkward to reach by
// playing normally. They're matched against the engine's debug-tagged words, so they
// resolve to the developer version of a word (eg "get") rather than any same-named
// in-game verb.
// A line consisting of "---" (optionally followed by a label, eg "--- test 2: trunk")
// ends the current test and restarts a fresh game for what follows. If the first word
// after "---" is "sandbox" (eg "--- sandbox"), the player is also teleported into an
// empty sandbox room, so a following "@item" directive can test an item in isolation.
// Lines starting with "@" are directives that set up test state rather than playing
// the game, eg "@item <id>" moves an item into the player's current location (the
// sandbox room, typically) so its verbs become available.
// Other lines are are tested to see if they match the output
// Lines starting with a "#" are ignored
// Lines staring with a "!" are negative matches.  An error will be thrown if the message is found
export class ScriptRunner {
    messages : string[] = [];
    print : PrintFn;
    engine : EngineFacade;
    error : PrintFn;
    restartEngine? : () => EngineFacade;

    constructor(engine : EngineFacade, print : PrintFn, error : PrintFn = print, restartEngine? : () => EngineFacade) {
        this.engine = engine;
        this.print = print;
        this.error = error;
        this.restartEngine = restartEngine;
    }

    async run(nextLine : () => Promise<string | null>) : Promise<Result> {
        this.flushOutput();
        let lineNum = 1;
        let line : string | null;
        let result : Result = "SUCCESS";
        while((line = await nextLine()) !== null) {
            try {
                this.executeLine(line);
            } catch (e) {
                this.error(`Failed on line ${lineNum}: ${line}`);
                if (isScriptError(e)) {
                    this.error("");
                    if (e.output.length > 0) {
                        e.output.forEach(message => this.error(message));
                    }
                    this.error("");
                    this.error(`${e.message}`);
                    result = "FAILURE";
                } else {
                    throw e;
                }
            }
            lineNum++;
        }
        return result;
    }

    // Runs a line of a script
    // Lines starting with a "$" are commands, lines starting with a ">" are developer commands
    // Other lines are expected to be message content.
    private executeLine(input : string) {
        const line = input.trim();
        if (line.startsWith("$")) {
            this.print(line);
            this.runCommand(line.slice(1).trim().split(" "), false);
            this.messages.length = 0;
            this.flushOutput();
        } else if (line.startsWith(">")) {
            this.print(line);
            this.runCommand(line.slice(1).trim().split(" "), true);
            this.messages.length = 0;
            this.flushOutput();
        } else if (line.startsWith("---")) {
            this.print(line);
            // The first word after "---" selects the mode; a trailing ":" (eg
            // "--- sandbox: test the hook") is stripped so the label reads naturally.
            const [modeWord] = line.slice(3).trim().split(/\s+/).filter(Boolean);
            const mode = modeWord?.replace(/:$/, "");
            this.restart();
            if (mode === "sandbox") {
                this.enterSandbox();
            }
        } else if (line.startsWith("@")) {
            this.print(line);
            this.executeDirective(line.slice(1).trim());
        } else if (line.startsWith("#")) {
            // Ignore it's a comment
        } else if (line.startsWith("!")) {
            const str = line.slice(1).trim();
            const found = this.messages.some(message => message.includes(str));
            if (found) {
                throw new ScriptError([...this.messages], `Unexpected string: "${str}"`);
            }
        } else if (line.length > 0) {
            const found = this.messages.some(message => message.includes(line));
            if (!found) {
                throw new ScriptError([...this.messages], `Expected string: "${line}"`);
            }
        }
    }

    private flushOutput(print = true) {
        this.engine.flushMessages(message => {
            if (print) {
                this.print(message.text);
            }
            this.messages.push(message.text);
        });
    }

    // Resolves and executes a command (or developer command) against the current engine,
    // without touching this.messages / printing the result - callers are responsible for
    // that, since "$"/">" lines want the output visible and assertable, while setup
    // helpers (enterSandbox, stageItem) want it suppressed.
    private runCommand(commandWords : string[], debugOnly : boolean) {
        const wordIds = this.matchCommand(this.engine.getWords(), [], commandWords, debugOnly);
        this.engine.execute(wordIds);
    }

    // Ends the current test and restarts a fresh game, per a "---" script line.
    private restart() {
        if (!this.restartEngine) {
            throw new ScriptError([], `"---" requires a restart handler, but none was configured`);
        }
        this.engine = this.restartEngine();
        this.messages.length = 0;
        this.flushOutput();
    }

    // Teleports the player into an empty sandbox room, per a "--- sandbox" script line,
    // so a following "@item" directive can test an item in isolation from the rest of
    // the game (every other entity still exists, just out of scope in a different room).
    private enterSandbox() {
        this.engine.load(SANDBOX_ROOM_YAML);
        // Loading content mid-script doesn't automatically refresh the word cache (see
        // EngineFacade.refreshWords), so without this the sandbox room wouldn't yet be
        // offered as a teleport target.
        this.engine.refreshWords();
        this.runCommand(["teleport", SANDBOX_ROOM_ID], true);
        this.messages.length = 0;
        this.flushOutput(false);
    }

    // Dispatches an "@" directive line, eg "@item <id>".
    private executeDirective(directiveLine : string) {
        const [directive, ...args] = directiveLine.split(/\s+/).filter(Boolean);
        if (directive === "item") {
            if (args.length !== 1) {
                throw new ScriptError([], `"@item" requires exactly one item id, got: "@${directiveLine}"`);
            }
            this.stageItem(args[0]);
        } else {
            throw new ScriptError([], `Unknown directive: "@${directive}"`);
        }
    }

    // Moves an item into the player's current location (typically the sandbox room),
    // so its verbs become available, without needing to fetch it via the normal game's
    // location graph. Implemented via the developer get/drop commands (see debug.ts).
    private stageItem(itemId : string) {
        this.runCommand(["get", itemId], true);
        this.runCommand(["drop", itemId], true);
        this.messages.length = 0;
        this.flushOutput(false);
    }

    // debugOnly restricts matching to developer/debug-tagged words (see engine/src/debug.ts),
    // so a ">" script command like "get" or "drop" resolves to the developer version rather
    // than any same-named in-game verb.
    private matchCommand(words : Word[],
                         match : Word[],
                         command : string[],
                         debugOnly : boolean) : string[] {
        if (command.length === 0) {
            return match.map(word => word.id);
        }

        const candidates = debugOnly ? words.filter(word => word.tags?.includes("debug")) : words;

        const commandTail = command;
        let commandHead = command.shift();

        let nextWord = candidates.find(word => word.value === commandHead);

        // The next word, might be a compound such as "velvet cloak",
        // so we need to keep adding words until we find a match
        while(!nextWord && command.length) {
            commandHead = commandHead?.concat(" ", command.shift() ?? "");
            nextWord = candidates.find(word => word.value === commandHead);
        }

        if (!nextWord) {
            throw new ScriptError([], `Expected command "${commandHead}"`);
        }

        const newMatch = match.concat(nextWord);
        const newWords = this.engine.getWords(newMatch);
        return this.matchCommand(newWords, newMatch, commandTail, debugOnly);
    }
}
