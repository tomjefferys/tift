import { matchVerb, matchObject, captureObject, matchBuilder, 
            attributeMatchBuilder, matchAttribute,
            matchIndirectObject, captureIndirectObject, matchModifier } from "../src/commandmatcher";
import { LOOK, EAT, GO, APPLE, STIR, SOUP, SPOON } from "./testutils/testentities";
import { verb } from "../src/command";

test("Test simple match", () => {
    const matcher = matchBuilder()
                        .withVerb(matchVerb("look"))
                        .build();
    const command = verb(LOOK);
    const result = matcher(command, LOOK.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.score).toBe(2);
})

test("Test match with direct object", () => {
    const matcher = matchBuilder()
                            .withVerb(matchVerb("eat"))
                            .withObject(matchObject("apple"))
                            .build();
    const command = verb(EAT).object(APPLE);
    const result = matcher(command, APPLE.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.score).toBe(12);
})

test("Test match with direct object capture", () => {
    const matcher = matchBuilder()
                            .withVerb(matchVerb("eat"))
                            .withObject(captureObject("food"))
                            .build();
    const command = verb(EAT).object(APPLE);
    const result = matcher(command, APPLE.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({ "food" : "apple"});
    expect(result.score).toBe(3);
})

test("Test partial match", () => {
    const matcher = matchBuilder()
                            .withVerb(matchVerb("eat"))
                            .build();
    const command = verb(EAT).object(APPLE);
    const result = matcher(command, APPLE.id);
    expect(result.isMatch).toBeFalsy();
    expect(result.score).toBe(2);
})

test("Test attribute match", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("stir"))
        .withObject(matchObject("soup"))
        .withAttribute(attributeMatchBuilder()
            .withAttribute(matchAttribute("with"))
            .withObject(matchIndirectObject("spoon")))
        .build();
    
    const command = verb(STIR).object(SOUP).preposition("with").object(SPOON);
    
    const result = matcher(command, SOUP.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.score).toBe(24);
})

test("Test capture indirect object", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("stir"))
        .withObject(matchObject("soup"))
        .withAttribute(attributeMatchBuilder()
            .withAttribute(matchAttribute("with"))
            .withObject(captureIndirectObject("tool")))
        .build();
    
    const command = verb(STIR).object(SOUP).preposition("with").object(SPOON);
    
    const result = matcher(command, SOUP.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({"tool" : "spoon"})
    expect(result.score).toBe(15);
})

test("Test capture direct and indirect object", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("stir"))
        .withObject(captureObject("container"))
        .withAttribute(attributeMatchBuilder()
            .withAttribute(matchAttribute("with"))
            .withObject(captureIndirectObject("tool")))
        .build();
    
    const command = verb(STIR).object(SOUP).preposition("with").object(SPOON);
    
    const result = matcher(command, SOUP.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({"container" : "soup", "tool" : "spoon"})
    expect(result.score).toBe(6);
})

test("Test capture with modifier", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("go"))
        .withModifier(matchModifier("direction", "north"))
        .build();

    const command = verb(GO).modifier("direction", "north");

    const result = matcher(command, GO.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.score).toBe(4);
});