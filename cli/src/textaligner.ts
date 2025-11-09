import { FormattedToken } from "./types";
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
        const lines : FormattedToken[][] = [];
        let currentLine : FormattedToken[] = [];
        let currentLineLength = 0;

        const tokenQueue = [...tokens];
        while (tokenQueue.length > 0) {
            const token = tokenQueue.shift()!;
            const tokenLength = token.text.length;
            const spaceLength = (currentLine.length && token.space !== "no-space") ? 1 : 0;
            let deltaLength = tokenLength + spaceLength; 

            // If tabbed add on tab space to the delta length
            if (token.space === "tabbed") {
                const nextTabStop = this.calculateNextTabStop(currentLineLength + spaceLength);
                deltaLength += (nextTabStop - (currentLineLength + spaceLength));
            }

            if (currentLineLength + deltaLength <= maxWidth) {
                // Token fits in current line
                currentLine.push(token);
                currentLineLength += deltaLength;
            } else if (currentLineLength === 0) {
                // Token itself exceeds max width, break the token so that it fits
                const startingText = token.text.slice(0, maxWidth);
                const remainingText = token.text.slice(maxWidth);
                lines.push([{ format: token.format, text: startingText }]);
                tokenQueue.unshift({ format: token.format, text: remainingText });
            } else {
                // Start a new line, and shift the token back to the queue
                lines.push(currentLine);
                currentLine = [];
                currentLineLength = 0;
                tokenQueue.unshift(token);
            }
        }

        if (currentLine.length > 0) {
            lines.push(currentLine);
        }

        return lines;
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
                    if (token.space !== "no-space") {
                        // We still add a space if tabbed to avoid tab length words running into each other
                        line += ' ';
                        lineLength += 1;
                    }
                    if (token.space === "tabbed") {
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