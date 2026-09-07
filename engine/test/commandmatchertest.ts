import { matchVerb, matchObject, captureObject, matchBuilder,
            attributeMatchBuilder, matchAttribute,
            matchIndirectObject, captureIndirectObject, matchModifier,
            subCommandMatchBuilder, matchSubVerb, captureSubVerb,
            matchSubObject, captureSubObject, matchSubModifier,
            subAttributeMatchBuilder, matchSubAttribute,
            matchSubIndirectObject, captureSubIndirectObject } from "../src/commandmatcher";
import { LOOK, EAT, GO, APPLE, STIR, SOUP, SPOON, TELL, ROBOT, FIRE, LASER } from "./testutils/testentities";
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
    expect(result.captures).toHaveProperty("food");
    expect(result.captures?.food).toMatchObject({ "id" : "apple" });
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
    expect(result.captures).toHaveProperty("tool");
    expect(result.captures?.tool).toMatchObject({"id" : "spoon"});
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
    expect(result.captures?.container).toMatchObject({ "id" : "soup" });
    expect(result.captures?.tool).toMatchObject({ "id" : "spoon" });
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

test("Test sub-command match with modifier", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("tell"))
        .withObject(matchObject("robot"))
        .withSubCommand(subCommandMatchBuilder()
            .withAttribute(matchAttribute("to"))
            .withSubVerb(matchSubVerb("go"))
            .withSubModifier(matchSubModifier("direction", "north")))
        .build();

    const command = verb(TELL).object(ROBOT).preposition("to").subVerb(GO).subModifier("direction", "north");

    const result = matcher(command, ROBOT.id);
    expect(result.isMatch).toBeTruthy();
})

test("Test sub-command capture sub-verb", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("tell"))
        .withObject(matchObject("robot"))
        .withSubCommand(subCommandMatchBuilder()
            .withAttribute(matchAttribute("to"))
            .withSubVerb(captureSubVerb("action"))
            .withSubModifier(matchSubModifier("direction", "north")))
        .build();

    const command = verb(TELL).object(ROBOT).preposition("to").subVerb(GO).subModifier("direction", "north");

    const result = matcher(command, ROBOT.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toHaveProperty("action");
    expect(result.captures?.action).toMatchObject({ "id" : "go" });
})

test("Test sub-command with direct object capture", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("tell"))
        .withObject(matchObject("robot"))
        .withSubCommand(subCommandMatchBuilder()
            .withAttribute(matchAttribute("to"))
            .withSubVerb(matchSubVerb("fire"))
            .withSubObject(captureSubObject("target")))
        .build();

    const command = verb(TELL).object(ROBOT).preposition("to").subVerb(FIRE).subObject(LASER);

    const result = matcher(command, ROBOT.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures).toHaveProperty("target");
    expect(result.captures?.target).toMatchObject({ "id" : "laser" });
})

test("Test sub-command with exact direct object", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("tell"))
        .withObject(matchObject("robot"))
        .withSubCommand(subCommandMatchBuilder()
            .withAttribute(matchAttribute("to"))
            .withSubVerb(matchSubVerb("fire"))
            .withSubObject(matchSubObject("laser")))
        .build();

    const command = verb(TELL).object(ROBOT).preposition("to").subVerb(FIRE).subObject(LASER);

    const result = matcher(command, ROBOT.id);
    expect(result.isMatch).toBeTruthy();
})

test("Test sub-command with attribute and indirect object", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("tell"))
        .withObject(matchObject("robot"))
        .withSubCommand(subCommandMatchBuilder()
            .withAttribute(matchAttribute("to"))
            .withSubVerb(matchSubVerb("stir"))
            .withSubObject(matchSubObject("soup"))
            .withSubAttribute(subAttributeMatchBuilder()
                .withAttribute(matchSubAttribute("with"))
                .withObject(matchSubIndirectObject("spoon"))))
        .build();

    const command = verb(TELL).object(ROBOT).preposition("to")
                        .subVerb(STIR).subObject(SOUP).subPreposition("with").subObject(SPOON);

    const result = matcher(command, ROBOT.id);
    expect(result.isMatch).toBeTruthy();
})

test("Test sub-command capture indirect object via attribute", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("tell"))
        .withObject(matchObject("robot"))
        .withSubCommand(subCommandMatchBuilder()
            .withAttribute(matchAttribute("to"))
            .withSubVerb(matchSubVerb("stir"))
            .withSubObject(captureSubObject("food"))
            .withSubAttribute(subAttributeMatchBuilder()
                .withAttribute(matchSubAttribute("with"))
                .withObject(captureSubIndirectObject("tool"))))
        .build();

    const command = verb(TELL).object(ROBOT).preposition("to")
                        .subVerb(STIR).subObject(SOUP).subPreposition("with").subObject(SPOON);

    const result = matcher(command, ROBOT.id);
    expect(result.isMatch).toBeTruthy();
    expect(result.captures?.food).toMatchObject({ "id" : "soup" });
    expect(result.captures?.tool).toMatchObject({ "id" : "spoon" });
})

test("Test sub-command with attribute doesn't match when indirect object missing", () => {
    const matcher = matchBuilder()
        .withVerb(matchVerb("tell"))
        .withObject(matchObject("robot"))
        .withSubCommand(subCommandMatchBuilder()
            .withAttribute(matchAttribute("to"))
            .withSubVerb(matchSubVerb("stir"))
            .withSubObject(matchSubObject("soup"))
            .withSubAttribute(subAttributeMatchBuilder()
                .withAttribute(matchSubAttribute("with"))
                .withObject(matchSubIndirectObject("spoon"))))
        .build();

    // No "with spoon" on the command, so a matcher that requires the sub-attribute fails
    const command = verb(TELL).object(ROBOT).preposition("to").subVerb(STIR).subObject(SOUP);

    const result = matcher(command, ROBOT.id);
    expect(result.isMatch).toBeFalsy();
})