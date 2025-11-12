import { FormattedToken } from "./formattedToken";
import { TokenFormatter, TokenListFormatter} from "./tokenformatter";

type GetTokenAligner = (
    consoleWidth : number,
    textWidth : number,
    tokenFormatter : TokenFormatter,
    tabSize? : number) => TokenListFormatter;

export const getTokenAligner : GetTokenAligner = (consoleWidth, textWidth, tokenFormatter, tabSize = 8) => {
    const textAligner = new TextAligner(consoleWidth, textWidth, tokenFormatter, tabSize);
    return (tokens) => textAligner.align(tokens);
}

class AlignerState {
    lines : FormattedToken[][];
    currentLine : FormattedToken[];
    currentLineLength : number;
    tokenQueue : FormattedToken[];
    longJoin : boolean;

    constructor(tokens : FormattedToken[]) {
        this.lines = [];
        this.currentLine = [];
        this.currentLineLength = 0;
        this.tokenQueue = [...tokens];
        this.longJoin = false;
    }

    addToken(token: FormattedToken, spaceLength: number) : void {
        this.currentLine.push(token);
        this.currentLineLength += token.text.length + spaceLength;
        //this.currentLineLength += token.text.length;
    }

    newLine() : void {
        this.lines.push([...this.currentLine]);
        this.currentLine.length = 0;
        this.currentLineLength = 0;
    }

    pushLine(line: FormattedToken[]) : void {
        this.lines.push([...line]);
    }
}

class TextAligner {
    readonly consoleWidth: number;
    readonly textWidth: number;
    readonly tokenFormatter: TokenFormatter;
    readonly tabSize: number;

    constructor(consoleWidth: number, textWidth: number, textFormatter: TokenFormatter, tabSize: number) {
        this.consoleWidth = consoleWidth;
        this.textWidth = textWidth;
        this.tokenFormatter = textFormatter;
        this.tabSize = tabSize;
    }

    align(tokens : FormattedToken[]) : string[] {
        const lines = this.alignTokens(tokens);
        const formattedLines = this.formatLines(lines);
        const paddedLines = this.padLines(formattedLines);
        return paddedLines;
    }

    private alignTokens(tokens : FormattedToken[]) : FormattedToken[][] {
        const maxWidth = Math.min(this.textWidth, this.consoleWidth);
        const state = new AlignerState(tokens);
        while (state.tokenQueue.length > 0) {
            const isJoinSet = this.isJoinSet(state.tokenQueue);
            const [spaceLength, totalLength] = this.getTotalNextTokenLength(state);

            if (state.longJoin && !isJoinSet) {
                // End long join mode
                state.longJoin = false;
            }

            const token = state.tokenQueue.shift()!;
            const tokenLength = token.text.length + spaceLength;

            if (state.currentLineLength + totalLength <= maxWidth) {
                // Token(s) fit in current line
                state.addToken(token, spaceLength);
            } else if (state.longJoin) {
                // In long join mode, treat the combined tokens as a single string,
                //  and break as needed
                if (state.currentLineLength + tokenLength > maxWidth) {
                    // Need to break the token to fit
                    const availableSpace = maxWidth - state.currentLineLength;
                    const startingText = token.text.slice(0, availableSpace);
                    const remainingText = token.text.slice(availableSpace);
                    state.currentLine.push({ format: token.format, text: startingText, space: token.space });
                    state.newLine();
                    state.tokenQueue.unshift({ format: token.format, text: remainingText, space: token.space });
                } else {
                    // Token fits in current line
                    state.addToken(token, spaceLength);
                }
            } else if (state.currentLineLength === 0) {
                // Token does not fit on an empty line
                if (state.currentLineLength + tokenLength <= maxWidth) {
                    // First token in join set fits, so add it.
                    state.longJoin = true;
                    state.addToken(token, spaceLength);
                } else {
                    // Token itself exceeds max width, break the token so that it fits
                    const startingText = token.text.slice(0, maxWidth);
                    const remainingText = token.text.slice(maxWidth);
                    state.pushLine([{ format: token.format, text: startingText }]);
                    state.tokenQueue.unshift({ format: token.format, text: remainingText });
                }
            } else {
                // Token(s) don't fit, start a new line\
                state.newLine();
                state.tokenQueue.unshift(token);
            }
        }

        if (state.currentLine.length > 0) {
            state.lines.push(state.currentLine);
        }

        return state.lines;
    }

    private getTotalNextTokenLength(state : AlignerState) : [number, number] {
        const nextToken = state.tokenQueue[0];
        let spaceLength = (state.currentLine.length && nextToken.space !== "join") ? 1 : 0;
        // If tabbed add on tab space to the delta length
        if (nextToken.space === "tab") {
            const nextTabStop = this.calculateNextTabStop(state.currentLineLength + spaceLength);
            spaceLength += (nextTabStop - (state.currentLineLength + spaceLength));
        }
        const nextTokenLength = spaceLength + nextToken.text.length;
        const joinedTokensLength = this.getJoinedLength(state.tokenQueue.slice(1));
        return [spaceLength, nextTokenLength + joinedTokensLength];
    }


    private getJoinedLength(tokens : FormattedToken[]) : number {
        let length = 0;
        for(const token of tokens) {
            if (token.space === "join") {
                length += token.text.length;
            } else {
                break;
            }
        }
        return length;
    }

    // Is join set if this token or the next token is join
    private isJoinSet(tokens : FormattedToken[]) : boolean {
        let result = false;
        if (tokens.length > 0) {
            result = tokens[0].space === "join";
        }
        if (tokens.length > 1) {
            result = result || tokens[1].space === "join";    
        }
        return result;
    }



    private formatLines(lines : FormattedToken[][]) : string[] {
        const formattedLines : string[] = [];
        
        for(const lineTokens of lines) {
            const formattedTokens = lineTokens.map(token => this.tokenFormatter(token));
            let line = '';
            let lineLength = 0;
            for(const token of lineTokens) {
                const tokenLength = token.text.length;
                if (lineLength === 0) {
                    line += this.tokenFormatter(token);
                    lineLength += tokenLength;
                } else {
                    if (token.space !== "join") {
                        // We still add a space if tabbed to avoid tab length words running into each other
                        line += ' ';
                        lineLength += 1;
                    }
                    if (token.space === "tab") {
                        const nextTabStop = this.calculateNextTabStop(lineLength);
                        const spacesToAdd = nextTabStop - lineLength;
                        line += ' '.repeat(spacesToAdd);
                        lineLength += spacesToAdd;
                    }
                    line += this.tokenFormatter(token);
                    lineLength += tokenLength;
                }
            }
            formattedLines.push(line);
        }

        return formattedLines;
    }

    private padLines(lines : string[]) : string[] {
        if (this.textWidth >= this.consoleWidth) {
            return lines;
        }
        const paddingLength = (this.consoleWidth - this.textWidth) / 2;
        const padding = ' '.repeat(paddingLength);
        return lines.map(line => padding + line);
    }

    private calculateNextTabStop(position: number) : number {
        return (position % this.tabSize === 0)
                    ? position
                    : position + (this.tabSize - (position % this.tabSize));
    }

}