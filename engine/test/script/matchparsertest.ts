import jsep from 'jsep'
import { setUpEnv } from "../testutils/testutils"
import { evaluateMatch } from "../../src/script/matchParser"
import { evaluate } from "../../src/script/parser"
import { EAT, LOOK, APPLE, STIR, SOUP, SPOON } from "../testutils/testentities"
import { SearchState } from "../../src/commandsearch"
import { IdValue, mkIdValue } from "../../src/shared"
import { mkThunk } from "../../src/script/thunk"

interface Nameable {
    id : string, 
    getName : () => string
}

test("Test no match", () => {
    const [env, messages] = setUpEnv();
    const expression = jsep("look()");
    const onMatch = evaluate(jsep("write('matched!')"));
    const searchState : SearchState = {
        verb : EAT,
        modifiers : {},
        words : buildWords(EAT)
    };

    const matchThunk = evaluateMatch(expression, onMatch);
    matchThunk.resolve(env.newChild({"SEARCHSTATE" : searchState }));

    expect(messages.length).toBe(0);
});

test("Test intransitve verb match", () => {
    const [env, messages] = setUpEnv();
    const expression = jsep("look()");
    const onMatch = evaluate(jsep("write('matched!')"));
    const searchState : SearchState = {
        verb : LOOK,
        modifiers : {},
        words : buildWords(LOOK)
    };

    const matchThunk = evaluateMatch(expression, onMatch);
    matchThunk.resolve(env.newChild({"SEARCHSTATE" : searchState }));

    expect(messages).toContain("matched!");
});

test("Test inttransive verb supplied as identifier", () => {
    const [env, messages] = setUpEnv();
    const expression = jsep("look");
    const onMatch = evaluate(jsep("write('matched!')"));
    const searchState : SearchState = {
        verb : LOOK,
        modifiers : {},
        words : buildWords(LOOK)
    };

    const matchThunk = evaluateMatch(expression, onMatch);
    matchThunk.resolve(env.newChild({"SEARCHSTATE" : searchState }));
    expect(messages).toContain("matched!");
});

test("Test transitive verb match", () => {
    const [env, messages] = setUpEnv();
    const expression = jsep("eat(apple)");
    const onMatch = evaluate(jsep("write('matched!')"));
    const searchState : SearchState =  {
        verb : EAT,
        directObject : APPLE,
        modifiers : {},
        words : buildWords(EAT, APPLE)
    }

    const matchThunk = evaluateMatch(expression, onMatch);
    matchThunk.resolve(env.newChild({"SEARCHSTATE" : searchState }));

    expect(messages).toContain("matched!");
});

test("Test direct object capture", () => {
    const [env, messages] = setUpEnv();
    const expression = jsep("eat($food)");
    const onMatch = evaluate(jsep("do(write('matched!'), write(food))"));
    const searchState : SearchState =  {
        verb : EAT,
        directObject : APPLE,
        modifiers : {},
        words : buildWords(EAT, APPLE)
    }

    const matchThunk = evaluateMatch(expression, onMatch);
    matchThunk.resolve(env.newChild({"SEARCHSTATE" : searchState }));

    expect(messages).toContain("matched!");
    expect(messages).toContain("apple");
});

test("Test attributed verb", () => {
    const [env, messages] = setUpEnv();
    const expression = jsep("stir(soup).with(spoon)");
    const onMatch = evaluate(jsep("write('matched!')"));
    const searchState : SearchState =  {
        verb : STIR,
        directObject : SOUP,
        indirectObject : SPOON,
        attribute : "with",
        modifiers : {},
        words : buildWords(EAT, APPLE)
    }

    const matchThunk = evaluateMatch(expression, onMatch);
    matchThunk.resolve(env.newChild({"SEARCHSTATE" : searchState }));

    expect(messages).toContain("matched!");
});

function buildWords(...words : Nameable[]) : IdValue<string>[] {
    return words.map(word => mkIdValue(word.id, word.getName()));
}