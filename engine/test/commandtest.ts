import { fromSearchState, verb } from "../src/command"
import { createSearchState, nameable } from "./testutils/searchstate";
import { EAT, APPLE, STIR, SOUP, SPOON, LOOK, GO, PUSH, BOX } from "./testutils/testentities"

test("Test verb object", () => {
    const eatApple = verb(EAT).object(APPLE);

    expect(eatApple.hasVerb("eat")).toBeTruthy();
    expect(eatApple.hasVerb("stir")).toBeFalsy();
    expect(eatApple.hasDirectObject("apple")).toBeTruthy();
    expect(eatApple.hasDirectObject("spoon")).toBeFalsy();
    expect(eatApple.hasPreposition("with")).toBeFalsy();
    expect(eatApple.hasIndirectObject("spoon")).toBeFalsy();
    expect(eatApple.hasModifier("speed", "slowly")).toBeFalsy();
})

test("Test verb object prepos indirect object", () => {
    const stirSoupWithSpoon = verb(STIR).object(SOUP).preposition("with").object(SPOON);
    
    expect(stirSoupWithSpoon.hasVerb("stir")).toBeTruthy();
    expect(stirSoupWithSpoon.hasVerb("eat")).toBeFalsy();
    expect(stirSoupWithSpoon.hasDirectObject("soup")).toBeTruthy();
    expect(stirSoupWithSpoon.hasDirectObject("spoon")).toBeFalsy();
    expect(stirSoupWithSpoon.hasPreposition("with")).toBeTruthy();
    expect(stirSoupWithSpoon.hasPreposition("at")).toBeFalsy();
    expect(stirSoupWithSpoon.hasIndirectObject("spoon")).toBeTruthy();
    expect(stirSoupWithSpoon.hasIndirectObject("soup")).toBeFalsy();
    expect(stirSoupWithSpoon.hasModifier("speed", "slowly")).toBeFalsy();
})

test("Test fromSearchState", () => {
    const look = fromSearchState(createSearchState({ verb : LOOK}, LOOK));
    expect(look.hasVerb("look")).toBeTruthy();

    const eatApple = fromSearchState(createSearchState( { verb : EAT, directObject : APPLE }, EAT, APPLE));
    expect(eatApple.hasVerb("eat")).toBeTruthy();
    expect(eatApple.hasDirectObject("apple")).toBeTruthy();

    const goNorth = fromSearchState(createSearchState( { verb : GO, modifiers : { "direction" : "north"}}, GO, nameable("north"))); 
    expect(goNorth.hasVerb("go")).toBeTruthy();
    expect(goNorth.hasModifier("direction", "north")).toBeTruthy();

    const stirSoupWithSpoon = fromSearchState(createSearchState(
        { verb : STIR, directObject : SOUP, attribute : "with", indirectObject : SPOON}, STIR, SOUP, nameable("with"), SPOON));
    expect(stirSoupWithSpoon.hasVerb("stir")).toBeTruthy();
    expect(stirSoupWithSpoon.hasDirectObject("soup")).toBeTruthy();
    expect(stirSoupWithSpoon.hasPreposition("with")).toBeTruthy();
    expect(stirSoupWithSpoon.hasIndirectObject("spoon")).toBeTruthy();

    const pushBoxNorth = fromSearchState(createSearchState(
        { verb : PUSH, directObject : BOX, modifiers : {"direction" : "north"}}, PUSH, BOX, nameable("north")));
    expect(pushBoxNorth.hasVerb("push")).toBeTruthy();
    expect(pushBoxNorth.hasDirectObject("box")).toBeTruthy();
    expect(pushBoxNorth.hasModifier("direction", "north")).toBeTruthy();
    
})