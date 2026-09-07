import { start } from "../src/command"
import { EAT, APPLE, STIR, SOUP, SPOON, LOOK, ASK, BARKEEP, BEER,
         TELL, ROBOT, GO, FIRE, LASER, LIE, BED } from "./testutils/testentities"

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

test("Test sub-command with modifier", () => {
    const tellRobotToGo = start().verb(TELL).object(ROBOT).preposition("to").subVerb(GO);

    expect(tellRobotToGo.getVerb("tell")).toBeTruthy();
    expect(tellRobotToGo.getDirectObject("robot")).toBeTruthy();
    expect(tellRobotToGo.getPreposition("to")).toBeTruthy();
    expect(tellRobotToGo.getSubVerb("go")).toBeTruthy();
    expect(tellRobotToGo.getSubVerb("fire")).toBeFalsy();
    // "tell robot to go" isn't complete until a direction is chosen
    expect(tellRobotToGo.isValid()).toBeFalsy();

    const tellRobotToGoNorth = tellRobotToGo.subModifier("direction", "north");
    expect(tellRobotToGoNorth.getSubModifier("direction", "north")).toBeTruthy();
    expect(tellRobotToGoNorth.getSubModifier("direction", "south")).toBeFalsy();
    expect(tellRobotToGoNorth.isValid()).toBeTruthy();

    expect(tellRobotToGoNorth.getWords().map(idValue => idValue.id))
                .toStrictEqual(["tell", "robot", "to", "go", "north"]);
    expect(tellRobotToGoNorth.size()).toBe(5);
})

test("Test sub-command with object", () => {
    const tellRobotToFire = start().verb(TELL).object(ROBOT).preposition("to").subVerb(FIRE);
    // "tell robot to fire" isn't complete until a target is chosen
    expect(tellRobotToFire.isValid()).toBeFalsy();

    const tellRobotToFireLaser = tellRobotToFire.subObject(LASER);
    expect(tellRobotToFireLaser.getSubObject("laser")).toBeTruthy();
    expect(tellRobotToFireLaser.isValid()).toBeTruthy();
    expect(tellRobotToFireLaser.getWords().map(idValue => idValue.id))
                .toStrictEqual(["tell", "robot", "to", "fire", "laser"]);
})

test("Test sub-command with attribute and indirect object", () => {
    const tellRobotToStirSoup = start().verb(TELL).object(ROBOT).preposition("to").subVerb(STIR).subObject(SOUP);
    // STIR is indirectOptional, so "tell robot to stir soup" alone is already complete
    expect(tellRobotToStirSoup.isValid()).toBeTruthy();

    const tellRobotToStirSoupWith = tellRobotToStirSoup.subPreposition("with");
    expect(tellRobotToStirSoupWith.getSubPreposition("with")).toBeTruthy();
    expect(tellRobotToStirSoupWith.getSubPreposition("on")).toBeFalsy();
    // "...with" alone, with no indirect object chosen yet, isn't complete
    expect(tellRobotToStirSoupWith.isValid()).toBeFalsy();

    const tellRobotToStirSoupWithSpoon = tellRobotToStirSoupWith.subObject(SPOON);
    expect(tellRobotToStirSoupWithSpoon.getSubIndirectObject("spoon")).toBeTruthy();
    expect(tellRobotToStirSoupWithSpoon.getSubIndirectObject("soup")).toBeFalsy();
    expect(tellRobotToStirSoupWithSpoon.isValid()).toBeTruthy();

    expect(tellRobotToStirSoupWithSpoon.getWords().map(idValue => idValue.id))
                .toStrictEqual(["tell", "robot", "to", "stir", "soup", "with", "spoon"]);
    expect(tellRobotToStirSoupWithSpoon.size()).toBe(7);
})

test("Test sub-command intransitive verb with attribute", () => {
    const tellRobotToLie = start().verb(TELL).object(ROBOT).preposition("to").subVerb(LIE);
    // Unlike STIR, LIE isn't indirectOptional, so "tell robot to lie" alone isn't complete
    expect(tellRobotToLie.isValid()).toBeFalsy();

    const tellRobotToLieOnBed = tellRobotToLie.subPreposition("on").subObject(BED);
    expect(tellRobotToLieOnBed.isValid()).toBeTruthy();
    expect(tellRobotToLieOnBed.getWords().map(idValue => idValue.id))
                .toStrictEqual(["tell", "robot", "to", "lie", "on", "bed"]);
})