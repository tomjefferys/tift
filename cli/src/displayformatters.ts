import { CommandState, CommandFormatter, WordsFormatter } from "./display";
import pc from "picocolors";

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