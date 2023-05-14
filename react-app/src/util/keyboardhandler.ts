import { Word } from "tift-types/src/messages/output";
import { Optional } from "tift-types/src/util/optional";
import { BACKSPACE } from "./util";

//const ALPHA_NUMERIC_REGEX = /^[a-zA-Z0-9]$/;

export interface Words {
    partial : string;
    selected : Optional<Word>;
    filtered : Word[];
}

export function handleKeyboardInput(partialWord : string, allWords : Word[], e : KeyboardEvent) : Words {
    const words : Words = {
    partial : partialWord,
        selected : undefined,
        filtered : allWords
    }

    const alphaNumericRegex = /^[a-zA-Z0-9]$/;
    let wordMatch : Optional<Word> = undefined;
    if (e.altKey || e.ctrlKey || e.metaKey) {
        return words;
    }
    if (e.key.match(alphaNumericRegex)) {
        words.partial = words.partial + e.key;
    } else if (e.key === " ") {
        const wordMatches = allWords.filter(word => word.value.startsWith(words.partial));
        if (wordMatches.length === 1) {
            wordMatch = wordMatches[0];
        } else if (wordMatches.length > 1) {
            words.partial = findCommonPrefix(wordMatches);
            wordMatch = wordMatches.find(word => word.value === words.partial);
        } else { 
            words.partial += " ";
        }
    } else if (e.key === "Enter") {
        const completedWords = allWords.filter(word => word.value.startsWith(words.partial));
        if (completedWords.length === 1) {
            wordMatch = completedWords[0];
        } else if (completedWords.length === 0) {
            words.partial = "";
        }
    } else if (e.key === "Backspace") {
        if (words.partial.length) {
            words.partial = words.partial.slice(0,-1);
        } else {
            words.selected = BACKSPACE;
        }
    }

    words.filtered = allWords.filter(word => word.value.startsWith(words.partial));
    if (wordMatch) {
        words.selected = wordMatch;
        words.partial = "";
    } 

    return words;
}

function findCommonPrefix(words : Word[]) : string {
    let commonPrefix = "";
    for(let i=0; i<words[0].value.length; i++) {
        if (words.every(word => word.value[i] === words[0].value[i])) {
            commonPrefix += words[0].value[i];
        }
    }
    return commonPrefix;
}

