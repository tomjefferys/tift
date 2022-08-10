import { VerbBuilder, VerbTrait } from "../src/verb";
import { ContextEntities, SearchState } from "../src/commandsearch";
import { matchVerb, matchObject, captureObject, verbMatchBuilder, 
            attributeMatchBuilder, matchAttribute, Matcher,
            matchIndirectObject, captureIndirectObject } from "../src/commandmatcher";
import { LOOK, EAT, GO, APPLE, STIR, SOUP, SPOON } from "./testutils/testentities";
import { mkIdValue } from "../src/shared";
import { match } from "../src/actionmatcher";

test("Test simple match", () => {
    const matcher = verbMatchBuilder()
                        .withVerb(matchVerb("look"))
                        .build();
    const state : SearchState = mkSearchState({ verb : LOOK }, "look");
    const result = matcher(state);
    expect(result.isMatch).toBeTruthy();
})

test("Test match with direct object", () => {
    const matcher = verbMatchBuilder()
                            .withVerb(matchVerb("eat"))
                            .withObject(matchObject("apple"))
                            .build();
    const state = mkSearchState({ verb : EAT, directObject : APPLE}, "eat", "apple")
    const result = matcher(state);
    expect(result.isMatch).toBeTruthy();
})

test("Test match with direct object capture", () => {
    const matcher = verbMatchBuilder()
                            .withVerb(matchVerb("eat"))
                            .withObject(captureObject("food"))
                            .build();
    const state = mkSearchState({ verb : EAT, directObject : APPLE}, "eat", "apple")
    const result = matcher(state);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({ "food" : "apple"});
})

test("Test partial match", () => {
    const matcher = verbMatchBuilder()
                            .withVerb(matchVerb("eat"))
                            .build();
    const state = mkSearchState({ verb : EAT, directObject : APPLE}, "eat", "apple")
    const result = matcher(state);
    expect(result.isMatch).toBeFalsy();
})

test("Test attribute match", () => {
    const matcher = verbMatchBuilder()
        .withVerb(matchVerb("stir"))
        .withObject(matchObject("soup"))
        .withAttribute(attributeMatchBuilder()
            .withAttribute(matchAttribute("with"))
            .withObject(matchIndirectObject("spoon")))
        .build();
    
    const state = mkSearchState({ 
        verb : STIR,
        directObject : SOUP,
        attribute : "with",
        indirectObject : SPOON}, "stir", "soup", "with", "spoon");
    
    const result = matcher(state);
    expect(result.isMatch).toBeTruthy();
})

test("Test capture indirect object", () => {
    const matcher = verbMatchBuilder()
        .withVerb(matchVerb("stir"))
        .withObject(matchObject("soup"))
        .withAttribute(attributeMatchBuilder()
            .withAttribute(matchAttribute("with"))
            .withObject(captureIndirectObject("tool")))
        .build();
    
    const state = mkSearchState({ 
        verb : STIR,
        directObject : SOUP,
        attribute : "with",
        indirectObject : SPOON}, "stir", "soup", "with", "spoon");
    
    const result = matcher(state);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({"tool" : "spoon"})
})

test("Test capture direct and indirect object", () => {
    const matcher = verbMatchBuilder()
        .withVerb(matchVerb("stir"))
        .withObject(captureObject("container"))
        .withAttribute(attributeMatchBuilder()
            .withAttribute(matchAttribute("with"))
            .withObject(captureIndirectObject("tool")))
        .build();
    
    const state = mkSearchState({ 
        verb : STIR,
        directObject : SOUP,
        attribute : "with",
        indirectObject : SPOON}, "stir", "soup", "with", "spoon");
    
    const result = matcher(state);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({"container" : "soup", "tool" : "spoon"})
})

function mkSearchState(partial : Partial<SearchState>, ...words : string[]) : SearchState {
    return { 
        modifiers : {},
        ...partial,
        words : words.map(word => mkIdValue(word, word))
    }
}