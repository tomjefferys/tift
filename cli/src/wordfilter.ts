import { Word } from "tift-types/src/messages/word";

export function createWordFilter(specialPatterns : Record<string, string>) {
    return (words : Word[], prefixChars : string[]) : Word[] => {
        let prefix = prefixChars.join("");
        if (specialPatterns[prefix]) {
            prefix = specialPatterns[prefix];
        }
    
        const matched = words.filter(word => word.value.startsWith(prefix));
        return matched;
    };
}