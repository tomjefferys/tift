import * as os from "os";
 import { Message, MessageFormatter, DEFAULT_MESSAGE_FORMATTER } from "./message";

export interface DisplayState {
    messages : Message[];
    partialCommand : string[];
    partialWord : string[];
    wordChoices : string[];
}

export class Display {
    private stdout : NodeJS.WriteStream;
    private messageFormatter : MessageFormatter

    constructor(stdout : NodeJS.WriteStream, messageFormatter : MessageFormatter = DEFAULT_MESSAGE_FORMATTER) {
        this.stdout = stdout;
        this.messageFormatter = messageFormatter;
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
        this.stdout.write(state.partialCommand.join(" "));
        this.stdout.write(state.partialWord.join(""));
        this.stdout.write("\n");
        for(const word of state.wordChoices) {
            this.stdout.write(word + "\t");
        }
        this.stdout.write("\n");
    }
}