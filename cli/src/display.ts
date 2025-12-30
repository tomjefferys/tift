import * as os from "os";
import { Message } from "./types";
import { MessageFormatter, DEFAULT_MESSAGE_FORMATTER } from "./message";

export interface CommandState  {
    partialCommand : string[];
    partialWord : string[];
    wordChoices : string[];
    selectedWordIndex? : number;
}

export interface DisplayState extends CommandState {
    messages : Message[];
}

export type CommandFormatter = (state : CommandState) => string[];
export type WordsFormatter = (state : CommandState) => string[];
export class Display {
    private stdout : NodeJS.WriteStream;
    private messageFormatter : MessageFormatter
    private commandFormatter : CommandFormatter
    private wordsFormatter : WordsFormatter
    private commandAreaLines = 0;

    constructor(stdout : NodeJS.WriteStream,
                messageFormatter : MessageFormatter = DEFAULT_MESSAGE_FORMATTER,
                commandFormatter : CommandFormatter = (state) => [state.partialCommand.join(" ") + state.partialWord.join("")],
                wordsFormatter : WordsFormatter = (state) => [state.wordChoices.join("\t")]) {
        this.stdout = stdout;
        this.messageFormatter = messageFormatter;
        this.commandFormatter = commandFormatter;
        this.wordsFormatter = wordsFormatter;
    }

    update(state : DisplayState) {
        this.clearCommandArea();
        state.messages.forEach(message => this.printMessage(message));
        this.printCommandArea(state);
    }

    printMessage(message : Message) {
        const formatted = this.messageFormatter(message);
        this.stdout.write(formatted + os.EOL);
    }

    clearCommandArea() {
        for(let i = 0; i < this.commandAreaLines; i++) {
            this.stdout.moveCursor(0,-1);
            this.stdout.clearLine(1);
        }
        this.commandAreaLines = 0;
    }

    printLine(str : string) {
        this.stdout.write(str + os.EOL);
    }

    print(words : string[], separator = " ") {
        this.stdout.write(words.join(separator) + os.EOL);
    }

    printCommandArea(state : DisplayState) {
        const commandLines = this.commandFormatter(state);
        const wordsLines = this.wordsFormatter(state);
        const allLines = [...commandLines, ...wordsLines];
        this.stdout.write(allLines.join(os.EOL) + os.EOL);

        this.commandAreaLines = allLines.length;
    }

    clearScreen() {
        this.stdout.write('\x1Bc');
    }
}