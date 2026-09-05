import { Word } from "tift-types/src/messages/word";
import { EngineFacade } from "./enginefacade";
import { Result } from "./types";
import pc from "picocolors";

export type PrintFn = (message : string) => void;

// The outcome of a single test section (a run of script between "---" dividers, or the
// whole script if it contains no dividers). "label" comes from the text after "---"
// (see ScriptRunner.parseDivider); when absent, the section is reported by its 1-based
// index instead.
interface SectionResult {
    index : number;
    label : string | undefined;
    passed : boolean;
}

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
// ends the current test section and restarts a fresh game for what follows. If the
// first word after "---" is "sandbox" (eg "--- sandbox"), the player is also teleported
// into an empty sandbox room, so a following "@item" directive can test an item in
// isolation.
// Lines starting with "@" are directives that set up test state rather than playing
// the game, eg "@item <id>" moves an item into the player's current location (the
// sandbox room, typically) so its verbs become available.
// Other lines are are tested to see if they match the output
// Lines starting with a "#" are ignored
// Lines staring with a "!" are negative matches.  An error will be thrown if the message is found
// Lines starting with "!$" are negative commands, eg "!$ get candle" - an error will be
// thrown if the command actually resolves (ie the game would let you build it), so this
// asserts a command is NOT available, complementing the positive "$" command.
//
// A script is divided into test sections by "---" lines (the text before the first
// "---", if any, is itself section 1). The moment any line in a section fails, the
// rest of that section is skipped - execution resumes at the next "---". Each
// section's pass/fail is tracked and reported in a summary once the whole script has
// run (see run()).
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

        // Section bookkeeping. Section 1 is whatever precedes the first "---" (even if
        // that's nothing); each "---" thereafter starts a new, higher-numbered section.
        let sectionIndex = 1;
        let currentLabel : string | undefined;
        let currentFailed = false;
        let sectionHasContent = false;
        let skipping = false;
        const results : SectionResult[] = [];

        const finalizeSection = () => {
            if (sectionHasContent) {
                results.push({ index : sectionIndex, label : currentLabel, passed : !currentFailed });
            }
        };

        while((line = await nextLine()) !== null) {
            const trimmed = line.trim();
            if (trimmed.startsWith("---")) {
                finalizeSection();
                sectionIndex++;
                currentLabel = this.parseDivider(trimmed).label;
                currentFailed = false;
                sectionHasContent = false;
                skipping = false;
                try {
                    this.executeLine(line);
                } catch (e) {
                    if (isScriptError(e)) {
                        this.printFailure(lineNum, line, e);
                        currentFailed = true;
                        skipping = true;
                        // The divider itself is what failed (eg no restart handler
                        // configured), so record this as a failed section even though
                        // no further lines follow it.
                        sectionHasContent = true;
                    } else {
                        throw e;
                    }
                }
                lineNum++;
                continue;
            }

            if (skipping) {
                lineNum++;
                continue;
            }

            if (this.isExecutableLine(trimmed)) {
                sectionHasContent = true;
            }

            try {
                this.executeLine(line);
            } catch (e) {
                if (isScriptError(e)) {
                    this.printFailure(lineNum, line, e);
                    currentFailed = true;
                    // Stop running this section - a failed line usually means the game
                    // state no longer matches what later lines assume - but keep going
                    // from the next "---" so a single failure doesn't blank out the
                    // rest of the report.
                    skipping = true;
                } else {
                    throw e;
                }
            }
            lineNum++;
        }
        finalizeSection();

        this.printSummary(results);

        return results.every(section => section.passed) ? "SUCCESS" : "FAILURE";
    }

    // A line counts towards a section "having content" (and so being worth reporting)
    // if it isn't blank and isn't a comment. "---" lines are handled separately by the
    // caller and never reach here.
    private isExecutableLine(trimmed : string) : boolean {
        return trimmed.length > 0 && !trimmed.startsWith("#");
    }

    // Prints a single failed line, in red, including whatever output the game had
    // produced by that point (uncoloured, for readability) and the failure reason.
    private printFailure(lineNum : number, line : string, e : ScriptError) {
        this.error(pc.red(pc.bold(`Failed on line ${lineNum}: ${line}`)));
        this.error("");
        if (e.output.length > 0) {
            e.output.forEach(message => this.error(message));
        }
        this.error("");
        this.error(pc.red(e.message));
    }

    // Prints a pass/fail line per recorded test section, followed by an overall tally,
    // eg:
    //   Test summary:
    //     ✓ Test 1
    //     ✗ restart test: confirm state doesn't carry over
    //   1 passed, 1 failed
    private printSummary(results : SectionResult[]) {
        if (results.length === 0) {
            return;
        }
        this.error("");
        this.error("Test summary:");
        results.forEach(({ index, label, passed }) => {
            const name = label ?? `Test ${index}`;
            this.error(passed ? pc.green(`  ✓ ${name}`) : pc.red(`  ✗ ${name}`));
        });
        const failedCount = results.filter(section => !section.passed).length;
        if (failedCount === 0) {
            const plural = results.length === 1 ? "" : "s";
            this.error(pc.green(`All ${results.length} test${plural} passed`));
        } else {
            this.error(pc.red(`${results.length - failedCount} passed, ${failedCount} failed`));
        }
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
            const { mode } = this.parseDivider(line);
            this.restart();
            if (mode === "sandbox") {
                this.enterSandbox();
            }
        } else if (line.startsWith("@")) {
            this.print(line);
            this.executeDirective(line.slice(1).trim());
        } else if (line.startsWith("#")) {
            // Ignore it's a comment
        } else if (line.startsWith("!$")) {
            this.print(line);
            const commandWords = line.slice(2).trim().split(" ");
            const commandText = commandWords.join(" ");
            let available : boolean;
            try {
                available = this.isCommandAvailable([...commandWords], false);
            } finally {
                // isCommandAvailable() probes the engine's word cache one word at a
                // time (via getWords()), which leaves it pointing at whatever partial
                // command it stopped on instead of the top level. Reset it so the next
                // script line starts matching from the top level again, same as after
                // a real execute().
                this.engine.refreshWords();
            }
            if (available) {
                throw new ScriptError([...this.messages], `Command unexpectedly available: "${commandText}"`);
            }
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

    // Checks whether a command fully resolves to a word-id sequence, without executing
    // it - used by "!$" lines to assert a command is NOT currently buildable. Note
    // matchCommand() mutates commandWords (via Array.shift), so callers that still need
    // the original words afterwards (eg for an error message) should pass a copy.
    private isCommandAvailable(commandWords : string[], debugOnly : boolean) : boolean {
        try {
            this.matchCommand(this.engine.getWords(), [], commandWords, debugOnly);
            return true;
        } catch (e) {
            if (isScriptError(e)) {
                return false;
            }
            throw e;
        }
    }

    // Parses a "---" script line into its mode word (eg "sandbox") and a display label,
    // eg:
    //   "---"                                -> { mode: undefined, label: undefined }
    //   "--- test 2: trunk"                  -> { mode: "test", label: "test 2: trunk" }
    //   "--- sandbox"                        -> { mode: "sandbox", label: undefined }
    //   "--- sandbox: test the hook"         -> { mode: "sandbox", label: "test the hook" }
    // For "sandbox" the mode word itself is excluded from the label so it reads
    // naturally; for any other (or no) mode word, the whole remainder is the label.
    private parseDivider(line : string) : { mode : string | undefined, label : string | undefined } {
        const rest = line.slice(3).trim();
        const [modeWord, ...restWords] = rest.split(/\s+/).filter(Boolean);
        const mode = modeWord?.replace(/:$/, "");
        const label = mode === "sandbox"
            ? (restWords.join(" ").trim() || undefined)
            : (rest || undefined);
        return { mode, label };
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

        // A word's value might be a compound, eg "velvet cloak" or "get down" - try the
        // longest possible prefix of the remaining command first, so a multi-word
        // value isn't shadowed by a shorter one that happens to match its first word
        // (eg "get down" vs the unrelated single-word verb "get").
        for (let len = command.length; len >= 1; len--) {
            const commandHead = command.slice(0, len).join(" ");
            const nextWord = candidates.find(word => word.value === commandHead);
            if (nextWord) {
                const newMatch = match.concat(nextWord);
                const newWords = this.engine.getWords(newMatch);
                return this.matchCommand(newWords, newMatch, command.slice(len), debugOnly);
            }
        }

        throw new ScriptError([], `Expected command "${command[0]}"`);
    }
}
