import { Word } from "tift-types/src/messages/word";

export function createWordFilter(specialPatterns : Record<string, string>) {
    return (words : Word[], prefixChars : string[], exactMatch = false) : Word[] => {
        let prefix = prefixChars.join("");
        if (specialPatterns[prefix]) {
            prefix = specialPatterns[prefix];
        }

        const matched = words.filter(
            word => exactMatch? word.value === prefix : word.value.startsWith(prefix));
        return matched;
    };
}