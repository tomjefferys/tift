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
    const result = matcher(command);
    expect(result.isMatch).toBeTruthy();
})

test("Test match with direct object", () => {
    const matcher = matchBuilder()
                            .withVerb(matchVerb("eat"))
                            .withObject(matchObject("apple"))
                            .build();
    const command = verb(EAT).object(APPLE);
    const result = matcher(command);
    expect(result.isMatch).toBeTruthy();
})

test("Test match with direct object capture", () => {
    const matcher = matchBuilder()
                            .withVerb(matchVerb("eat"))
                            .withObject(captureObject("food"))
                            .build();
    const command = verb(EAT).object(APPLE);
    const result = matcher(command);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({ "food" : "apple"});
})

test("Test partial match", () => {
    const matcher = matchBuilder()
                            .withVerb(matchVerb("eat"))
                            .build();
    const command = verb(EAT).object(APPLE);
    const result = matcher(command);
    expect(result.isMatch).toBeFalsy();
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
    
    const result = matcher(command);
    expect(result.isMatch).toBeTruthy();
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
    
    const result = matcher(command);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({"tool" : "spoon"})
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
    
    const result = matcher(command);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toStrictEqual({"container" : "soup", "tool" : "spoon"})
})

test("Test capture with modifier", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("go"))
        .withModifier(matchModifier("direction", "north"))
        .build();

    const command = verb(GO).modifier("direction", "north");

    const result = matcher(command);
    expect(result.isMatch).toBeTruthy();
});