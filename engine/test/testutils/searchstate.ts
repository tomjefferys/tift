import { SearchState } from "../../src/commandsearch"
import { IdValue, mkIdValue } from "../../src/shared"

export interface Nameable {
    id : string, 
    getName : () => string
}

export const nameable : (id : string) => Nameable = id => ({id : id, getName : () => id});

export function createSearchState(state : Partial<SearchState>, ...words : Nameable[]) : SearchState {
    return {modifiers : {}, words : buildWords(...words), ...state};
}

export function buildWords(...words : Nameable[]) : IdValue<string>[] {
    return words.map(word => mkIdValue(word.id, word.getName()));
}
