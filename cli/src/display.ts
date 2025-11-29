import * as os from "os";
import { Message } from "./types";
import { MessageFormatter, DEFAULT_MESSAGE_FORMATTER } from "./message";

export interface CommandState  {
    partialCommand : string[];
    partialWord : string[];
    wordChoices : string[];
}

export interface DisplayState extends CommandState {
    messages : Message[];
}

export type CommandFormatter = (state : CommandState) => string;
export type WordsFormatter = (state : CommandState) => string;
export class Display {
    private stdout : NodeJS.WriteStream;
    private messageFormatter : MessageFormatter
    private commandFormatter : CommandFormatter
    private wordsFormatter : WordsFormatter

    constructor(stdout : NodeJS.WriteStream,
                messageFormatter : MessageFormatter = DEFAULT_MESSAGE_FORMATTER,
                commandFormatter : CommandFormatter = (state) => state.partialCommand.join(" ") + state.partialWord.join(""),
                wordsFormatter : WordsFormatter = (state) => state.wordChoices.join("\t")) {
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
        this.stdout.moveCursor(0,-1);
        this.stdout.clearLine(1);
        this.stdout.moveCursor(0,-1);
        this.stdout.clearLine(1);
    }

    printLine(str : string) {
        this.stdout.write(str + "\n");
    }

    print(words : string[], seperator = " ") {
        this.stdout.write(words.join(seperator) + "\n");
    }

    printCommandArea(state : DisplayState) {
        this.stdout.write(this.commandFormatter(state));
        this.stdout.write("\n");
        this.stdout.write(this.wordsFormatter(state));
        this.stdout.write("\n");
    }

    clearScreen() {
        this.stdout.write('\x1Bc');
    }
}