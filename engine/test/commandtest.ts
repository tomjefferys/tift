import { start } from "../src/command"
import { EAT, APPLE, STIR, SOUP, SPOON, LOOK, ASK, BARKEEP, BEER } from "./testutils/testentities"

test("Test verb object", () => {
    const eatApple = start().verb(EAT).object(APPLE);

    expect(eatApple.getVerb("eat")).toBeTruthy();
    expect(eatApple.getVerb("stir")).toBeFalsy();
    expect(eatApple.getDirectObject("apple")).toBeTruthy();
    expect(eatApple.getDirectObject("spoon")).toBeFalsy();
    expect(eatApple.getPreposition("with")).toBeFalsy();
    expect(eatApple.getIndirectObject("spoon")).toBeFalsy();
    expect(eatApple.getModifier("speed", "slowly")).toBeFalsy();

    expect(eatApple.getWords().map(idValue => idValue.id)).toStrictEqual(["eat", "apple"]);
    expect(eatApple.size()).toBe(2);
})

test("Test verb object prepos indirect object", () => {
    const stirSoupWithSpoon = start().verb(STIR).object(SOUP).preposition("with").object(SPOON);
    
    expect(stirSoupWithSpoon.getVerb("stir")).toBeTruthy();
    expect(stirSoupWithSpoon.getVerb("eat")).toBeFalsy();
    expect(stirSoupWithSpoon.getDirectObject("soup")).toBeTruthy();
    expect(stirSoupWithSpoon.getDirectObject("spoon")).toBeFalsy();
    expect(stirSoupWithSpoon.getPreposition("with")).toBeTruthy();
    expect(stirSoupWithSpoon.getPreposition("at")).toBeFalsy();
    expect(stirSoupWithSpoon.getIndirectObject("spoon")).toBeTruthy();
    expect(stirSoupWithSpoon.getIndirectObject("soup")).toBeFalsy();
    expect(stirSoupWithSpoon.getModifier("speed", "slowly")).toBeFalsy();

    expect(stirSoupWithSpoon.getWords().map(idValue => idValue.id)).toStrictEqual(["stir", "soup", "with", "spoon"]);
    expect(stirSoupWithSpoon.size()).toBe(4);
})

test("Test command validity", () => {
    expect(start().verb(LOOK).isValid()).toBeTruthy();
    expect(start().verb(EAT).isValid()).toBeFalsy();
    expect(start().verb(EAT).object(APPLE)).toBeTruthy();
    expect(start().verb(STIR).object(SOUP).isValid()).toBeTruthy();
    expect(start().verb(STIR).object(SOUP).preposition("with").isValid()).toBeFalsy();
    expect(start().verb(STIR).object(SOUP).preposition("with").object(SPOON).isValid()).toBeTruthy();
    expect(start().verb(ASK).object(BARKEEP).isValid()).toBeFalsy();
    expect(start().verb(ASK).object(BARKEEP).preposition("about").isValid()).toBeFalsy();
    expect(start().verb(ASK).object(BARKEEP).preposition("about").object(BEER).isValid()).toBeTruthy();
})