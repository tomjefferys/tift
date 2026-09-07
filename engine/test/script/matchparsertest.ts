import jsep from 'jsep'
import { setUpEnv } from "../testutils/testutils"
import { evaluateMatchExpression } from "../../src/script/matchParser"
import { evaluate } from "../../src/script/parser"
import { EAT, LOOK, APPLE, STIR, SOUP, SPOON, GO, PUSH, BOX,
         TELL, ROBOT, FIRE, LASER } from "../testutils/testentities"
import { Env } from 'tift-types/src/env'
import { Command, start } from '../../src/command'
import _ from 'lodash'

const MATCH_STRING = "matched!";
const DEFALT_ONMATCH = "write('" + MATCH_STRING + "')";

let env : Env;
let messages : string[];

beforeEach(() => {
    [env, messages] = setUpEnv();
});


test("Test no match", () => {
    const command = start().verb(EAT)
    doMatch(command, "look()");
    expect(messages).toHaveLength(0);
});

test("Test intransitve verb match", () => {
    const command = start().verb(LOOK);
    doMatch(command, "look()");
    expect(messages).toContain("matched!");
});

test("Test intransive verb supplied as identifier", () => {
    const command = start().verb(LOOK);
    doMatch(command, "look");
    expect(messages).toContain(MATCH_STRING);
});

test("Test transitive verb match", () => {
    const command = start().verb(EAT).object(APPLE);
    doMatch(command, "eat(apple)");
    expect(messages).toContain(MATCH_STRING);
});

test("Test transitive verb as identifier without direct object", () => {
    const command = start().verb(EAT).object(APPLE);
    doMatch(command, "eat");
    expect(messages).toHaveLength(0);
});

test("Test transitive verb without direct object", () => {
    const command = start().verb(EAT).object(APPLE);
    doMatch(command, "eat()")
    expect(messages).toHaveLength(0);
});

test("Test direct object capture", () => {
    const command = start().verb(EAT).object(APPLE);
    doMatch(command, "eat($food) ","do(write('matched!'), write(food.id))"  )
    expect(messages).toContain(MATCH_STRING);
    expect(messages).toContain("apple");
});

test("Test attributed verb", () => {
    const command = start().verb(STIR).object(SOUP).preposition("with").object(SPOON);
    doMatch(command, "stir(soup).with(spoon)");
    expect(messages).toContain(MATCH_STRING);
});

test("Test intransitive verb with modifier", () => {
    const command = start().verb(GO).modifier("direction", "north");
        
    doMatch(command, "go(north)");
    expect(messages).toContain(MATCH_STRING);
}); 

test("Test intransitive verb with modifier capture", () => {
    const command = start().verb(GO).modifier("direction", "north");
    doMatch(command, "go($direction)", "do(write('matched!'), write(direction))");
    expect(messages).toContain(MATCH_STRING);
    expect(messages).toContain("north");
});

test("Test intransitive verb with wrong modifier", () => {
    const command = start().verb(GO).modifier("direction", "south");
    doMatch(command, "go(north)");
    expect(messages).toHaveLength(0);
}); 

test("Test transitive verb with modifier", () => {
    const command = start().verb(PUSH).object(BOX).modifier("direction", "north");
    
    doMatch(command, "push(box, north)");
    expect(messages).toContain(MATCH_STRING);
})

test("Test transitive verb with modifier, no modifier supplied", () => {
    const command = start().verb(PUSH).object(BOX);
    
    doMatch(command, "push(box, north)");
    expect(messages).toHaveLength(0);
});

test("Test transitive verb without modifier, modifier supplied", () => {
    const command = start().verb(PUSH).object(BOX).modifier("direction", "north");

    doMatch(command, "push(box)");
    expect(messages).toHaveLength(0);
});

test("Test transitive verb with modifier capture", () => {
    const command = start().verb(PUSH).object(BOX).modifier("direction", "north");
    doMatch(command, "push(box, $direction)", "do(write('matched!'), write(direction))");
    expect(messages).toContain(MATCH_STRING);
    expect(messages).toContain("north");
});

test("Test clausal verb sub-command with modifier", () => {
    const command = start().verb(TELL).object(ROBOT).preposition("to").subVerb(GO).subModifier("direction", "north");
    doMatch(command, "tell(robot).to(go($direction))", "do(write('matched!'), write(direction))");
    expect(messages).toContain(MATCH_STRING);
    expect(messages).toContain("north");
});

test("Test clausal verb sub-command with bare intransitive sub-verb", () => {
    // A bare identifier sub-verb (no parens/args) is equivalent to an empty call,
    // same as at the top level (eg "look" == "look()")
    const command = start().verb(TELL).object(ROBOT).preposition("to").subVerb(GO).subModifier("direction", "north");
    doMatch(command, "tell(robot).to(go(north))");
    expect(messages).toContain(MATCH_STRING);
});

test("Test clausal verb sub-command capturing the sub-verb", () => {
    const command = start().verb(TELL).object(ROBOT).preposition("to").subVerb(GO).subModifier("direction", "north");
    doMatch(command, "tell(robot).to($action($direction))", "do(write('matched!'), write(action.id), write(direction))");
    expect(messages).toContain(MATCH_STRING);
    expect(messages).toContain("go");
    expect(messages).toContain("north");
});

test("Test clausal verb sub-command with direct object", () => {
    const command = start().verb(TELL).object(ROBOT).preposition("to").subVerb(FIRE).subObject(LASER);
    doMatch(command, "tell(robot).to(fire($target))", "do(write('matched!'), write(target.id))");
    expect(messages).toContain(MATCH_STRING);
    expect(messages).toContain("laser");
});

test("Test clausal verb sub-command with wrong sub-verb doesn't match", () => {
    const command = start().verb(TELL).object(ROBOT).preposition("to").subVerb(GO).subModifier("direction", "north");
    doMatch(command, "tell(robot).to(fire($target))");
    expect(messages).toHaveLength(0);
});

test("Test non-clausal attributed verb is unaffected by clausal handling", () => {
    const command = start().verb(STIR).object(SOUP).preposition("with").object(SPOON);
    doMatch(command, "stir(soup).with(spoon)");
    expect(messages).toContain(MATCH_STRING);
});

test("Test clausal verb sub-command with attributed sub-verb", () => {
    const command = start().verb(TELL).object(ROBOT).preposition("to")
                        .subVerb(STIR).subObject(SOUP).subPreposition("with").subObject(SPOON);
    doMatch(command, "tell(robot).to(stir(soup).with(spoon))");
    expect(messages).toContain(MATCH_STRING);
});

test("Test clausal verb sub-command with attributed sub-verb captures", () => {
    const command = start().verb(TELL).object(ROBOT).preposition("to")
                        .subVerb(STIR).subObject(SOUP).subPreposition("with").subObject(SPOON);
    doMatch(command, "tell(robot).to(stir($item).with($tool))",
                     "do(write('matched!'), write(item.id), write(tool.id))");
    expect(messages).toContain(MATCH_STRING);
    expect(messages).toContain("soup");
    expect(messages).toContain("spoon");
});

test("Test clausal verb sub-command with indirectOptional attributed sub-verb, no attribute given", () => {
    // STIR is indirectOptional, so "tell(this).to(stir(soup))" alone should match a
    // sub-command that doesn't specify "with spoon"
    const command = start().verb(TELL).object(ROBOT).preposition("to").subVerb(STIR).subObject(SOUP);
    doMatch(command, "tell(robot).to(stir(soup))");
    expect(messages).toContain(MATCH_STRING);
});

test("Test clausal verb sub-command attribute doesn't match when not given", () => {
    const command = start().verb(TELL).object(ROBOT).preposition("to").subVerb(STIR).subObject(SOUP);
    doMatch(command, "tell(robot).to(stir(soup).with(spoon))");
    expect(messages).toHaveLength(0);
});

test("Test clausal verb sub-command with multiple arguments throws", () => {
    // The clausal verb's attribute must take a single nested command, not a flat arg list
    expect(() => doMatch(start().verb(TELL), "tell(robot).to(go, north)")).toThrow();
});

function doMatch(command : Command, match : string, onMatch = DEFALT_ONMATCH) {
    const expression = jsep(match);
    const matcher = evaluateMatchExpression(expression);
    const onMatchThunk = evaluate(jsep(onMatch));
    const result = matcher(command, "")
    if (result.isMatch) {
       onMatchThunk.resolve(env.newChild(result.captures ?? {}));
    }
}
