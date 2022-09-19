export interface DisplayState {
    messages : string[];
    partialCommand : string[];
    partialWord : string[];
    wordChoices : string[];
}

export class Display {
    private stdout : NodeJS.WriteStream;

    constructor(stdout : NodeJS.WriteStream) {
        this.stdout = stdout;
    }

    update(state : DisplayState) {
        this.clearCommandArea();
        state.messages.forEach(message => this.stdout.write(message + "\n"));
        this.printCommandArea(state);
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