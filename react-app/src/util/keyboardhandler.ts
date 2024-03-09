import { Word } from "tift-types/src/messages/word";
import { Optional } from "tift-types/src/util/optional";
import { BACKSPACE } from "./util";

const ALPHA_NUMERIC_REGEX = /^[a-zA-Z0-9]$/;

export interface Words {
    partial : string;
    selected : Optional<Word>;
    filtered : Word[];
}

export function handleKeyboardInput(partialWord : string, allWords : Word[], e : KeyboardEvent) : Words {
    if (e.altKey || e.ctrlKey || e.metaKey) {
        return words(partialWord, undefined, allWords);
    }

    const [newWords, wordMatch] = handleKey(words(partialWord, undefined, allWords), allWords, e.key);

    newWords.filtered = allWords.filter(word => word.value.toLowerCase().startsWith(newWords.partial.toLowerCase()));
    if (wordMatch) {
        newWords.selected = wordMatch;
        newWords.partial = "";
    } 

    return newWords;
}

function handleKey(words : Words, allWords : Word[], key : string) : [Words, Optional<Word>] {
    let wordMatch : Optional<Word> = undefined;
    const partial = words.partial.toLowerCase();
    if (key.match(ALPHA_NUMERIC_REGEX)) {
        words.partial = words.partial + key;
    } else if (key === " ") {
        const wordMatches = allWords.filter(word => word.value.toLowerCase().startsWith(partial));
        if (wordMatches.length === 1) {
            wordMatch = wordMatches[0];
        } else if (wordMatches.length > 1) {
            words.partial = findCommonPrefix(wordMatches);
            wordMatch = wordMatches.find(word => word.value.toLowerCase() === partial);
        } else { 
            words.partial += " ";
        }
    } else if (key === "Enter") {
        const completedWords = allWords.filter(word => word.value.toLowerCase().startsWith(partial));
        if (completedWords.length === 1) {
            wordMatch = completedWords[0];
        } else if (completedWords.length === 0) {
            words.partial = "";
        }
    } else if (key === "Backspace") {
        if (words.partial.length) {
            words.partial = words.partial.slice(0,-1);
        } else {
            words.selected = BACKSPACE;
        }
    }
    return [words, wordMatch];
}

function findCommonPrefix(words : Word[]) : string {
    let commonPrefix = "";
    for(let i=0; i<words[0].value.length; i++) {
        if (words.every(word => word.value[i]?.toLowerCase() === words[0].value[i]?.toLowerCase())) {
            commonPrefix += words[0].value[i];
        }
    }
    return commonPrefix;
}

function words(partial : string, selected : Optional<Word>, filtered : Word[]) {
    return { partial, selected, filtered };
}

