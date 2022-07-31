import { VerbBuilder, VerbTrait } from "../src/verb";
import { ContextEntities, SearchState } from "../src/commandsearch";
import { matchObject, captureObject, verbMatchBuilder } from "../src/commandmatcher";
import { LOOK, EAT, GO, APPLE } from "./testutils/testentities";
import { mkIdValue } from "../src/shared";

test("Test simple match", () => {
    const matcher = verbMatchBuilder()
                        .withVerb("look")
                        .build();
    const state : SearchState = mkSearchState({ verb : LOOK }, "look");
    const result = matcher.match(state);
    expect(result.isMatch).toBeTruthy();
})

test("Test match with direct object", () => {
    const matcher = verbMatchBuilder()
                            .withVerb("eat")
                            .withObject(matchObject("apple"))
                            .build();
    const state = mkSearchState({ verb : EAT, directObject : APPLE}, "eat", "apple")
    const result = matcher.match(state);
    expect(result.isMatch).toBeTruthy();
})

test("Test match with direct object capture", () => {
    const matcher = verbMatchBuilder()
                            .withVerb("eat")
                            .withObject(captureObject("food"))
                            .build();
    const state = mkSearchState({ verb : EAT, directObject : APPLE}, "eat", "apple")
    const result = matcher.match(state);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({ "food" : "apple"});
})

test("Test partial match", () => {
    const matcher = verbMatchBuilder()
                            .withVerb("eat")
                            .build();
    const state = mkSearchState({ verb : EAT, directObject : APPLE}, "eat", "apple")
    const result = matcher.match(state);
    expect(result.isMatch).toBeFalsy();
})


function mkSearchState(partial : Partial<SearchState>, ...words : string[]) : SearchState {
    return { 
        modifiers : {},
        ...partial,
        words : words.map(word => mkIdValue(word, word))
    }
}