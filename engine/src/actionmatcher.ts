import { BindingMap } from "./types";


// A match result is true/false + bindings
export interface MatchResultSuccess {
    readonly match : true,
    bindings : BindingMap
}

export interface MatchResultFailure {
    readonly match : false
}

export type MatchResult = MatchResultSuccess | MatchResultFailure;

export type ActionMatcher = (words: string[]) => MatchResult;

interface WordMatch {
    isCapture : false;
    match : string;
}

interface Capture {
    isCapture : true;
    name : string;
}

type Match = WordMatch | Capture;

export function match(word : string) : Match {
    return {
        isCapture : false,
        match : word
    }
}

export function capture(name : string) : Match {
    return {
        isCapture : true,
        name : name
    }
}

export function getMatcher(expected : Match[]) : ActionMatcher {
    return (words: string[]) => {
        const fail : MatchResult = { match : false };
        if (words.length != expected.length) {
            return fail;
        }

        const bindings : BindingMap = {};
        let matchSuccess = true;
        for(let i = 0; i<words.length; i++) {
            const matcher = expected[i];
            if (matcher.isCapture) {
                bindings[matcher.name] = words[i];
            } else if (matcher.match !== words[i]) {
                matchSuccess = false;
                break;
            }
        }
        return (matchSuccess) ?  { match : true, bindings : bindings } : fail;
    } 
}
