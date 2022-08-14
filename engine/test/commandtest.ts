import { fromSearchState, verb } from "../src/command"
import { createSearchState, nameable } from "./testutils/searchstate";
import { EAT, APPLE, STIR, SOUP, SPOON, LOOK, GO, PUSH, BOX } from "./testutils/testentities"

test("Test verb object", () => {
    const eatApple = verb(EAT).object(APPLE);

    expect(eatApple.getVerb("eat")).toBeTruthy();
    expect(eatApple.getVerb("stir")).toBeFalsy();
    expect(eatApple.getDirectObject("apple")).toBeTruthy();
    expect(eatApple.getDirectObject("spoon")).toBeFalsy();
    expect(eatApple.getPreposition("with")).toBeFalsy();
    expect(eatApple.getIndirectObject("spoon")).toBeFalsy();
    expect(eatApple.getModifier("speed", "slowly")).toBeFalsy();
})

test("Test verb object prepos indirect object", () => {
    const stirSoupWithSpoon = verb(STIR).object(SOUP).preposition("with").object(SPOON);
    
    expect(stirSoupWithSpoon.getVerb("stir")).toBeTruthy();
    expect(stirSoupWithSpoon.getVerb("eat")).toBeFalsy();
    expect(stirSoupWithSpoon.getDirectObject("soup")).toBeTruthy();
    expect(stirSoupWithSpoon.getDirectObject("spoon")).toBeFalsy();
    expect(stirSoupWithSpoon.getPreposition("with")).toBeTruthy();
    expect(stirSoupWithSpoon.getPreposition("at")).toBeFalsy();
    expect(stirSoupWithSpoon.getIndirectObject("spoon")).toBeTruthy();
    expect(stirSoupWithSpoon.getIndirectObject("soup")).toBeFalsy();
    expect(stirSoupWithSpoon.getModifier("speed", "slowly")).toBeFalsy();
})

test("Test fromSearchState", () => {
    const look = fromSearchState(createSearchState({ verb : LOOK}, LOOK));
    expect(look.getVerb("look")).toBeTruthy();

    const eatApple = fromSearchState(createSearchState( { verb : EAT, directObject : APPLE }, EAT, APPLE));
    expect(eatApple.getVerb("eat")).toBeTruthy();
    expect(eatApple.getDirectObject("apple")).toBeTruthy();

    const goNorth = fromSearchState(createSearchState( { verb : GO, modifiers : { "direction" : "north"}}, GO, nameable("north"))); 
    expect(goNorth.getVerb("go")).toBeTruthy();
    expect(goNorth.getModifier("direction", "north")).toBeTruthy();

    const stirSoupWithSpoon = fromSearchState(createSearchState(
        { verb : STIR, directObject : SOUP, attribute : "with", indirectObject : SPOON}, STIR, SOUP, nameable("with"), SPOON));
    expect(stirSoupWithSpoon.getVerb("stir")).toBeTruthy();
    expect(stirSoupWithSpoon.getDirectObject("soup")).toBeTruthy();
    expect(stirSoupWithSpoon.getPreposition("with")).toBeTruthy();
    expect(stirSoupWithSpoon.getIndirectObject("spoon")).toBeTruthy();

    const pushBoxNorth = fromSearchState(createSearchState(
        { verb : PUSH, directObject : BOX, modifiers : {"direction" : "north"}}, PUSH, BOX, nameable("north")));
    expect(pushBoxNorth.getVerb("push")).toBeTruthy();
    expect(pushBoxNorth.getDirectObject("box")).toBeTruthy();
    expect(pushBoxNorth.getModifier("direction", "north")).toBeTruthy();
    
})