import { verb } from "../src/command"
import { EAT, APPLE, STIR, SOUP, SPOON } from "./testutils/testentities"

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