import { Word } from "tift-types/src/messages/word";
import { EngineFacade } from "./enginefacade";

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

// Runs a script line by line and checks the output
// against the expected messages
// Lines starting with a "$" are commands
// Other lines are are tested to see if they match the output
// Lines starting with a "#" are ignored
// Lines staring with a "!" are negative matches.  An error will be thrown if the message is found
export class ScriptRunner {
    messages : string[] = [];
    print : PrintFn;
    engine : EngineFacade;

    constructor(engine : EngineFacade, print : PrintFn) {
        this.engine = engine;
        this.print = print;
    }

    // Runs a line of a script
    // Lines starting with a "$" are commands
    // Other lines are expected to be message content.
    executeLine(input : string) {
        const line = input.trim();
        if (line.startsWith("$")) {
            this.print(line);
            const commandWords = line.slice(1).trim().split(" ");
            const wordIds = this.matchCommand(this.engine.getWords(), [], commandWords);
            this.engine.execute(wordIds);
            this.messages.length = 0;
            this.flushOutput();
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

    flushOutput() {
        this.engine.flushMessages(message => {
            this.print(message);
            this.messages.push(message);
        });
    }

    private matchCommand(words : Word[],
                         match : Word[],
                         command : string[]) : string[] {
        if (command.length === 0) {
            return match.map(word => word.id);
        }

        const commandTail = command;
        let commandHead = command.shift();

        let nextWord = words.find(word => word.value === commandHead);

        // The next word, might be a compound such as "velvet cloak",
        // so we need to keep adding words until we find a match
        while(!nextWord && command.length) {
            commandHead = commandHead?.concat(" ", command.shift() ?? "");
            nextWord = words.find(word => word.value === commandHead);
        }

        if (!nextWord) {
            throw new ScriptError([], `Expected command "${commandHead}"`);
        }

        const newMatch = match.concat(nextWord);   
        const newWords = this.engine.getWords(newMatch);
        return this.matchCommand(newWords, newMatch, commandTail);
    }
}
