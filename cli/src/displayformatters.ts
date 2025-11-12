import { CommandState, CommandFormatter, WordsFormatter } from "./display";
import pc from "picocolors";
import * as os from "os";
import { TokenListFormatter } from "./tokenformatter";
import { token } from "./formattedToken";

export const DEFAULT_COMMAND_FORMATTER : CommandFormatter = (state : CommandState) => {
    return state.partialCommand.join(" ") + state.partialWord.join("");
}

export const DEFAULT_WORDS_FORMATTER : WordsFormatter = (state : CommandState) => {
    return state.wordChoices.join("\t");
}

export const ANSI_COMMAND_FORMATTER : CommandFormatter = (state : CommandState) => {
    const commandPart = pc.green(state.partialCommand.join(" "));
    const wordPart = pc.green(state.partialWord.join(""));
    return commandPart + wordPart;
}

export const getAlignedANSICommandFormatter = (textAligner : TokenListFormatter) : CommandFormatter => {
    return (state : CommandState) => {
        const createToken = (text: string) => ({
            text,
            format: "plain" as const,
            colour: {
                hue: "green" as const,
                brightness: "normal" as const
            }
        });

        const tokens = [
            ...state.partialCommand.map(word => createToken(word)),
            createToken(state.partialWord.join(""))
        ];

        const alignedCommandLines = textAligner(tokens);
        return alignedCommandLines.join(os.EOL);
    }
}

export const getAlignedANSIWordsFormatter = (textAligner : TokenListFormatter) : WordsFormatter => {
    return (state : CommandState) => {
        const prefix = state.partialWord.join("");
        const highlightedTokens = state.wordChoices.flatMap(word => {
            if (word.startsWith(prefix)) {
                const matchedPart = token(prefix, "tab", "green");
                const nextChar = word.charAt(prefix.length);
                const highlightedNextChar = token(nextChar, "join", "green", "bright");
                const restPart = word.slice(prefix.length + 1);
                const restToken = token(restPart, "join");
                return [matchedPart, highlightedNextChar, restToken];
            } else {
                return [token(word, "tab")];
            }
        });

        const alignedWordLines = textAligner(highlightedTokens.flat());
        return alignedWordLines.join(os.EOL);
    }
}


export const ALIGNED_ANSI_COMMAND_FORMATTER : CommandFormatter = (state : CommandState) => {

    const commandPart = pc.green(state.partialCommand.join(" "));
    const wordPart = pc.green(state.partialWord.join(""));
    return commandPart + wordPart;
}

export const ANSI_WORDS_FORMATTER : WordsFormatter = (state : CommandState) => {
    // Loop through state.wordChoices and color the characters that match state.partialWord in green, and the next letter green.
    const prefix = state.partialWord.join("");
    const highlightedWords = state.wordChoices.map(word => {
        if (word.startsWith(prefix)) {
            const matchedPart = pc.green(prefix);
            const nextChar = word.charAt(prefix.length);
            const highlightedNextChar = nextChar ? pc.green(nextChar) : "";
            const restPart = word.slice(prefix.length + 1);
            return matchedPart + highlightedNextChar + restPart;
        } else {
            return pc.green(word[0]) + word.slice(1);
        }
    });
    return highlightedWords.join("\t");
}