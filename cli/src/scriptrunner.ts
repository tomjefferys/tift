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

// Builds the YAML for a room with the given exits (direction -> target room id),
// used both for the initial empty sandbox room and for rooms created on demand by
// the "@room" directive (see createRoom()/executeDirective()).
function makeRoomYaml(id : string, exits : Record<string, string> = {}) : string {
    const name = id === SANDBOX_ROOM_ID ? "Sandbox" : id;
    const description = id === SANDBOX_ROOM_ID
        ? "An empty room, used to isolate an item for testing."
        : `An empty room named "${id}", created by a "@room" directive.`;
    const exitsYaml = Object.entries(exits)
        .map(([direction, target]) => `  ${direction}: ${target}`)
        .join("\n");
    return `
room: ${id}
name: ${name}
description: ${description}` + (exitsYaml ? `\nexits:\n${exitsYaml}\n` : "\n");
}

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
// "@room [<id>] <direction>:<targetId> ..." creates (or adds exits to) a dummy room,
// so a sandbox test can exercise motion (eg pushing an item between rooms, or the
// player walking). If the first token is an exit spec rather than an id (ie it
// contains a ":"), the exits are added to the sandbox room itself - this is the
// terse common case of testing motion into one adjacent room, eg
// "@room north:hall" gives the sandbox room a north exit to "hall" and creates
// "hall" as an empty room. Any target room id that hasn't already been created
// (by an earlier "@room", or the sandbox room itself) is auto-created as an empty
// room; a target that already exists is left alone. Exits accumulate across
// multiple "@room" directives on the same room id rather than replacing each
// other. Directions are one-way - declare the reverse explicitly on the other
// room (eg "@room hall south:__sandbox__") for two-way travel.
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
//
// A constructor-supplied testFilter restricts a run to sections whose "---" label
// contains it as a substring, letting a subset of tests in a file be run without
// splitting the file up (see matchesFilter()).
export class ScriptRunner {
    messages : string[] = [];
    print : PrintFn;
    engine : EngineFacade;
    error : PrintFn;
    restartEngine? : () => EngineFacade;
    testFilter? : string;

    // Exits accumulated so far for each dummy room created by "@room" (including the
    // sandbox room itself, once "--- sandbox" has run) - see executeDirective().
    // Reset on every restart, since "---" always starts a fresh game.
    roomExits : Map<string, Record<string, string>> = new Map();

    // testFilter, when given, restricts execution to sections whose "---" label
    // contains it as a substring (case-sensitive, like the "!"/plain-line message
    // matching elsewhere in this file). Sections with no label (including section 1,
    // when nothing precedes the first "---") never match a non-empty filter, and are
    // skipped along with everything else that doesn't match.
    constructor(engine : EngineFacade, print : PrintFn, error : PrintFn = print, restartEngine? : () => EngineFacade,
                testFilter? : string) {
        this.engine = engine;
        this.print = print;
        this.error = error;
        this.restartEngine = restartEngine;
        this.testFilter = testFilter;
    }

    private matchesFilter(label : string | undefined) : boolean {
        if (this.testFilter === undefined) {
            return true;
        }
        return label !== undefined && label.includes(this.testFilter);
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
        let sectionMatches = this.matchesFilter(currentLabel);
        let skipping = !sectionMatches;
        const results : SectionResult[] = [];

        const finalizeSection = () => {
            if (sectionHasContent && sectionMatches) {
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
                sectionMatches = this.matchesFilter(currentLabel);
                // A section that doesn't match testFilter is skipped outright,
                // including the "---" divider's own restart/sandbox setup - it has no
                // effect on later sections, since every "---" restarts the engine from
                // scratch regardless of what came before it.
                skipping = !sectionMatches;
                if (sectionMatches) {
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

        if (this.testFilter !== undefined && results.length === 0) {
            this.error(pc.red(`No test sections matched filter: "${this.testFilter}"`));
            return "FAILURE";
        }

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
        this.roomExits = new Map();
        this.messages.length = 0;
        this.flushOutput();
        const loadError = this.engine.getLastError();
        if (loadError) {
            // Without this check, a game that fails to (re)load (eg a YAML syntax
            // error) leaves every word list empty, so the next line - often the
            // sandbox's own "teleport" - would fail with a cryptic "Expected command
            // ..." instead of pointing at the real cause. this.messages already holds
            // the flushed error text, but flushOutput() only *prints* it (a no-op in
            // --silent mode), so it's passed through here too to guarantee it's part
            // of the reported failure.
            throw new ScriptError([...this.messages], `Failed to load game: ${loadError}`);
        }
    }

    // Teleports the player into an empty sandbox room, per a "--- sandbox" script line,
    // so a following "@item" directive can test an item in isolation from the rest of
    // the game (every other entity still exists, just out of scope in a different room).
    private enterSandbox() {
        this.roomExits.set(SANDBOX_ROOM_ID, {});
        this.engine.load(makeRoomYaml(SANDBOX_ROOM_ID));
        // Loading content mid-script doesn't automatically refresh the word cache (see
        // EngineFacade.refreshWords), so without this the sandbox room wouldn't yet be
        // offered as a teleport target.
        this.engine.refreshWords();
        this.runCommand(["teleport", SANDBOX_ROOM_ID], true);
        this.messages.length = 0;
        this.flushOutput(false);
    }

    // Loads (or reloads) a dummy room with the given exits - used by both
    // enterSandbox() and the "@room" directive. Reloading an existing room id
    // overwrites it in place (see EngineBuilder.addContent()), which is how "@room"
    // can add exits to a room (including the sandbox room) that already exists.
    private createRoom(id : string, exits : Record<string, string>) {
        this.engine.load(makeRoomYaml(id, exits));
    }

    // Dispatches an "@" directive line, eg "@item <id>".
    private executeDirective(directiveLine : string) {
        const [directive, ...args] = directiveLine.split(/\s+/).filter(Boolean);
        if (directive === "item") {
            if (args.length !== 1) {
                throw new ScriptError([], `"@item" requires exactly one item id, got: "@${directiveLine}"`);
            }
            this.stageItem(args[0]);
        } else if (directive === "room") {
            this.addRoom(args, directiveLine);
        } else {
            throw new ScriptError([], `Unknown directive: "@${directive}"`);
        }
    }

    // Creates (or adds exits to) a dummy room, per an "@room [<id>] <direction>:<targetId> ..."
    // script line - see the class doc comment above for the full syntax. Reloading a
    // room id that already exists just overwrites it with its accumulated exits (see
    // createRoom()), so this also handles adding exits to a room created earlier
    // (including the sandbox room itself).
    private addRoom(args : string[], directiveLine : string) {
        if (args.length === 0) {
            throw new ScriptError([], `"@room" requires a room id and/or at least one exit, got: "@${directiveLine}"`);
        }

        // If the first token is itself an exit spec (contains ":"), there's no
        // explicit id - the exits apply to the sandbox room, letting the common case
        // of testing motion into one adjacent room be written on a single line, eg
        // "@room north:hall".
        const [id, exitArgs] = args[0].includes(":")
            ? [SANDBOX_ROOM_ID, args]
            : [args[0], args.slice(1)];

        const newExits : Record<string, string> = {};
        for (const exitArg of exitArgs) {
            const separatorIndex = exitArg.indexOf(":");
            const direction = separatorIndex === -1 ? exitArg : exitArg.slice(0, separatorIndex);
            const target = separatorIndex === -1 ? "" : exitArg.slice(separatorIndex + 1);
            if (!direction || !target) {
                throw new ScriptError([], `"@room" exits must be in the form "<direction>:<targetId>", got: "${exitArg}"`);
            }
            newExits[direction] = target;
        }

        const exits = { ...this.roomExits.get(id), ...newExits };
        this.roomExits.set(id, exits);
        this.createRoom(id, exits);

        // Auto-create any target room that hasn't been declared yet, so motion into
        // it works immediately, without needing a separate "@room <target>" line. A
        // target that already exists (declared earlier, or the sandbox room) is left
        // untouched - only ever added to via its own "@room" line.
        for (const target of Object.values(newExits)) {
            if (!this.roomExits.has(target)) {
                this.roomExits.set(target, {});
                this.createRoom(target, {});
            }
        }

        this.engine.refreshWords();
        // Loading rooms shouldn't normally produce player-visible output, but swallow
        // anything it does (eg a load error), consistent with the other setup helpers
        // (enterSandbox, stageItem), so it can't leak into a later assertion.
        this.messages.length = 0;
        this.flushOutput(false);
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

        const candidates = words.filter(word => Boolean(word.tags?.includes("debug")) === debugOnly);

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
