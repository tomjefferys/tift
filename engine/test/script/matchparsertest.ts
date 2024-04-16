import jsep from 'jsep'
import { setUpEnv } from "../testutils/testutils"
import { evaluateMatchExpression } from "../../src/script/matchParser"
import { evaluate } from "../../src/script/parser"
import { EAT, LOOK, APPLE, STIR, SOUP, SPOON, GO, PUSH, BOX } from "../testutils/testentities"
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

function doMatch(command : Command, match : string, onMatch = DEFALT_ONMATCH) {
    const expression = jsep(match);
    const matcher = evaluateMatchExpression(expression);
    const onMatchThunk = evaluate(jsep(onMatch));
    const result = matcher(command, "")
    if (result.isMatch) {
       onMatchThunk.resolve(env.newChild(result.captures ?? {}));
    }
}
