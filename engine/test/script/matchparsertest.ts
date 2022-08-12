import jsep from 'jsep'
import { setUpEnv } from "../testutils/testutils"
import { evaluateMatch } from "../../src/script/matchParser"
import { evaluate } from "../../src/script/parser"
import { EAT, LOOK, APPLE, STIR, SOUP, SPOON, GO, PUSH, BOX } from "../testutils/testentities"
import { SearchState } from "../../src/commandsearch"
import { IdValue, mkIdValue } from "../../src/shared"
import { Env } from '../../src/env'
import _ from 'lodash'

interface Nameable {
    id : string, 
    getName : () => string
}

const nameable : (id : string) => Nameable = id => ({id : id, getName : () => id});

const WITH = nameable("with");
const NORTH = nameable("north");
const SOUTH = nameable("south");

const MATCH_STRING = "matched!";
const DEFALT_ONMATCH = "write('" + MATCH_STRING + "')";

let env : Env;
let messages : string[];

beforeEach(() => {
    [env, messages] = setUpEnv();
});


test("Test no match", () => {
    const searchState = createSearchState({verb : EAT}, EAT);
    doMatch(searchState, "look()");
    expect(messages).toHaveLength(0);
});

test("Test intransitve verb match", () => {
    const searchState = createSearchState({ verb : LOOK }, LOOK);
    doMatch(searchState, "look()");
    expect(messages).toContain("matched!");
});

test("Test intransive verb supplied as identifier", () => {
    const searchState = createSearchState({ verb : LOOK }, LOOK);
    doMatch(searchState, "look");
    expect(messages).toContain(MATCH_STRING);
});

test("Test transitive verb match", () => {
    const searchState = createSearchState({ verb : EAT, directObject : APPLE }, EAT, APPLE);
    doMatch(searchState, "eat(apple)");
    expect(messages).toContain(MATCH_STRING);
});

test("Test transitive verb as identifier without direct object", () => {
    const searchState = createSearchState({ verb : EAT, directObject : APPLE }, EAT, APPLE);
    doMatch(searchState, "eat");
    expect(messages).toHaveLength(0);
});

test("Test transitive verb without direct object", () => {
    const searchState = createSearchState({ verb : EAT, directObject : APPLE }, EAT, APPLE);
    doMatch(searchState, "eat()")
    expect(messages).toHaveLength(0);
});

test("Test direct object capture", () => {
    const searchState = createSearchState({ verb : EAT, directObject : APPLE}, EAT, APPLE);
    doMatch(searchState, "eat($food) ","do(write('matched!'), write(food))"  )
    expect(messages).toContain(MATCH_STRING);
    expect(messages).toContain("apple");
});

test("Test attributed verb", () => {
    const searchState = createSearchState(
        { verb : STIR, directObject : SOUP, attribute : "with", indirectObject : SPOON }, 
        STIR, SOUP, WITH, SPOON);
    doMatch(searchState, "stir(soup).with(spoon)");
    expect(messages).toContain(MATCH_STRING);
});

test("Test intransitive verb with modifier", () => {
    const searchState = createSearchState(
        { verb : GO, modifiers : { "direction" : "north"}}, GO, NORTH );
        
    doMatch(searchState, "go(north)");
    expect(messages).toContain(MATCH_STRING);
}); 

test("Test intransitive verb with wrong modifier", () => {
    const searchState = createSearchState(
        { verb : GO, modifiers : { "direction" : "south"}}, GO, SOUTH );
        
    doMatch(searchState, "go(north)");
    expect(messages).toHaveLength(0);
}); 

test("Test transitive verb with modifier", () => {
    const searchState = createSearchState(
        { verb : PUSH, directObject : BOX, modifiers : { "direction" : "north"}},
        PUSH, BOX, NORTH);
    
    doMatch(searchState, "push(box, north)");
    expect(messages).toContain(MATCH_STRING);
})

test("Test transitive verb with modifier, no modifier supplied", () => {
    const searchState = createSearchState(
        { verb : PUSH, directObject : BOX }, PUSH, BOX );
    
    doMatch(searchState, "push(box, north)");
    expect(messages).toHaveLength(0);
});

test("Test transitive verb without modifier, modifier supplied", () => {
    const searchState = createSearchState(
        { verb : PUSH, directObject : BOX, modifiers : { "direction" : "north"}},
        PUSH, BOX, NORTH);

    doMatch(searchState, "push(box)");
    expect(messages).toHaveLength(0);
});

function doMatch(state : SearchState, match : string, onMatch = DEFALT_ONMATCH) {
    const expression = jsep(match);
    const onMatchThunk = evaluate(jsep(onMatch));

    const matchThunk = evaluateMatch(expression, onMatchThunk);
    matchThunk.resolve(env.newChild({"SEARCHSTATE" : state }));
}

function createSearchState(state : Partial<SearchState>, ...words : Nameable[]) : SearchState {
    return {modifiers : {}, words : buildWords(...words), ...state};
}

function buildWords(...words : Nameable[]) : IdValue<string>[] {
    return words.map(word => mkIdValue(word.id, word.getName()));
}