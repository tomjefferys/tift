import { Word } from "tift-types/src/messages/word";
import * as WordTree from "./wordtree"

const DUMMY_POSITION = 0;

test("Test create/set/get", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("go"), words("east", "west"));

    expect(WordTree.get(root, words("go"))).toStrictEqual(words("east", "west"));
})

test("Test multilevel set", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push", "chair"), words("east", "west"));

    expect(WordTree.get(root, words("push"))).toStrictEqual(words("box", "chair"));
    expect(WordTree.get(root, words("push", "box"))).toStrictEqual(words("north", "south"));
    expect(WordTree.get(root, words("push", "chair"))).toStrictEqual(words("east", "west"));
    expect(WordTree.get(root, words("push", "box", "north"))).toStrictEqual(words());
    expect(WordTree.get(root, words("push", "box", "south"))).toStrictEqual(words());
    expect(WordTree.get(root, words("push", "chair", "east"))).toStrictEqual(words());
    expect(WordTree.get(root, words("push", "chair", "west"))).toStrictEqual(words());
    expect(WordTree.get(root, words("push", "table"))).toStrictEqual(words());
    expect(WordTree.get(root, words("get"))).toStrictEqual(words());
    expect(WordTree.get(root, words("get", "box"))).toStrictEqual(words());
})

test("Test set and reset", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push"), words("box", "chair"));

    expect(WordTree.get(root, words("push"))).toStrictEqual(words("box", "chair"));
    expect(WordTree.get(root, words("push", "box"))).toStrictEqual(words("north", "south"));

    WordTree.set(root, words("push", "box"), words("east", "west"));
    expect(WordTree.get(root, words("push", "box"))).toStrictEqual(words("north", "south", "east", "west"));
});

test("Test match prefix", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("get down"), []);
    WordTree.set(root, words("get"), words("ball", "bag"));
    const matches = WordTree.getWithPrefix(root, "get");

    //expect(matches).toStrictEqual(words("get down", "ball", "bag"));
    expect(matches).toStrictEqual([{...word("get down", DUMMY_POSITION, "down"), tags : ["truncated"]},
                                     word("ball", DUMMY_POSITION, "ball"),
                                     word("bag", DUMMY_POSITION, "bag")]);
});

test("Test match prefix transitive verb phrase", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("stand on"), words("stool"));
    const matches = WordTree.getWithPrefix(root, "stand on");
    expect(matches).toStrictEqual(words("stool"));
})

test("Test match prefix modified transitive verb", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("stool"));
    WordTree.set(root, words("push", "stool"), words("east", "west"));
    const matches = WordTree.getWithPrefix(root, "push stool");
    expect(matches).toStrictEqual(words("east", "west"));
})

test("Test match phrase", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("get down"), []);
    WordTree.set(root, words("drop"), words("umbrella", "rubber gloves"));
    WordTree.set(root, words("get"), words("ball", "bag"));

    expect(WordTree.matchPhrase(root, "get down")).toStrictEqual(words("get down"));
    expect(WordTree.matchPhrase(root, "get ball")).toStrictEqual(words("get", "ball"));
    expect(WordTree.matchPhrase(root, "drop rubber gloves")).toStrictEqual(words("drop", "rubber gloves"));
    expect(WordTree.matchPhrase(root, "get umbrella")).toBeUndefined();
    expect(WordTree.matchPhrase(root, "get")).toBeUndefined();
})

test("Test add leaf", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push", "chair"), words("east", "west"));

    WordTree.addLeaf(root, word("backspace", DUMMY_POSITION));

    expect(WordTree.get(root, [])).toStrictEqual(words("push"));
    expect(WordTree.get(root, words("push"))).toStrictEqual(words("box", "chair", "backspace"));
    expect(WordTree.get(root, words("push", "box"))).toStrictEqual(words("north", "south", "backspace"));
    expect(WordTree.get(root, words("push", "chair"))).toStrictEqual(words("east", "west", "backspace"));
});

test("Test set with wildcard at start", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("?", "ball"), words("drop", "throw"));
    
    expect(WordTree.get(root, [])).toStrictEqual(words("drop", "throw"))
    expect(WordTree.get(root, words("drop"))).toStrictEqual(words("ball"));
    expect(WordTree.get(root, words("throw"))).toStrictEqual(words("ball"));
});

test("Test set with wildcard and already populated tree", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box"));
    WordTree.set(root, words("?", "ball"), words("drop", "throw", "push"));

    expect(WordTree.get(root, [])).toStrictEqual(words("push", "drop", "throw"));
    expect(WordTree.get(root, words("drop"))).toStrictEqual(words("ball"));
    expect(WordTree.get(root, words("throw"))).toStrictEqual(words("ball"));
    expect(WordTree.get(root, words("push"))).toStrictEqual(words("box", "ball"));
});

test("Test getAll", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push", "chair"), words("east", "west"));

    expect(WordTree.getAll(root, words("push"))).toStrictEqual([words("push")]);
    expect(WordTree.getAll(root, words("push", "box"))).toStrictEqual([words("push", "box")]);
    expect(WordTree.getAll(root, words("push", "chair"))).toStrictEqual([words("push", "chair")]);
    expect(WordTree.getAll(root, words("push", "box", "north"))).toStrictEqual([words("push", "box", "north")]);
    expect(WordTree.getAll(root, words("push", "box", "east"))).toStrictEqual([]);

    expect(WordTree.getAll(root, words("?"))).toStrictEqual([words("push")]);
    expect(WordTree.getAll(root, words("?", "box"))).toStrictEqual([words("push", "box")]);
    expect(WordTree.getAll(root, words("push", "?"))).toStrictEqual([words("push", "box"), words("push", "chair")]);
    expect(WordTree.getAll(root, words("?", "?"))).toStrictEqual([words("push", "box"), words("push", "chair")]);
    expect(WordTree.getAll(root, words("?", "?", "north"))).toStrictEqual([words("push", "box", "north")]);
    expect(WordTree.getAll(root, words("?", "?", "northeast"))).toStrictEqual([]);
});

test("Test getAll not found", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push", "chair"), words("east", "west"));

    expect(WordTree.getAll(root, words("pull"))).toStrictEqual([]);
    expect(WordTree.getAll(root, words("push", "table"))).toStrictEqual([]);
});

test("Test getWildCardMatches", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push", "chair"), words("east", "west"));

    expect(WordTree.getWildCardMatches(root, words("?"))).toStrictEqual([words("push")]);
    expect(WordTree.getWildCardMatches(root, words("?", "box"))).toStrictEqual([words("push")]);
    expect(WordTree.getWildCardMatches(root, words("push", "?"))).toStrictEqual([words("box", "chair")]);
    expect(WordTree.getWildCardMatches(root, words("?", "?"))).toStrictEqual([words("push"), words("box", "chair")]);
    expect(WordTree.getWildCardMatches(root, words("?", "?", "north"))).toStrictEqual([words("push"), words("box")]);
    expect(WordTree.getWildCardMatches(root, words("?", "?", "northeast"))).toStrictEqual([[],[]]);
});

test("Test getSubTree with exact path", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push", "chair"), words("east", "west"));

    const subTree = WordTree.getSubTree(root, words("push", "box"));
    expect(WordTree.get(subTree, [])).toStrictEqual(words("push"));
    expect(WordTree.get(subTree, words("push"))).toStrictEqual(words("box"));
    expect(WordTree.get(subTree, words("push", "box"))).toStrictEqual([]);
});

test("Test getSubTree with wildcard", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push", "chair"), words("east", "west"));

    const subTree = WordTree.getSubTree(root, words("push", "?"));
    expect(WordTree.get(subTree, [])).toStrictEqual(words("push"));
    expect(WordTree.get(subTree, words("push"))).toStrictEqual(words("box", "chair"));
    expect(WordTree.get(subTree, words("push", "box"))).toStrictEqual([]);
    expect(WordTree.get(subTree, words("push", "chair"))).toStrictEqual([]);
});

test("Test getSubTree with partial path", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push", "chair"), words("east", "west"));

    const subTree = WordTree.getSubTree(root, words("push"));
    expect(WordTree.get(subTree, [])).toStrictEqual(words("push"));
    expect(WordTree.get(subTree, words("push"))).toStrictEqual([]);
});

test("Test getSubTree with non-existent path", () => {
    const root = WordTree.createRoot();
    WordTree.set(root, words("push"), words("box", "chair"));
    WordTree.set(root, words("push", "box"), words("north", "south"));
    WordTree.set(root, words("push", "chair"), words("east", "west"));

    const subTree = WordTree.getSubTree(root, words("pull"));
    expect(WordTree.get(subTree, [])).toStrictEqual([]);
});

function words(...wordList : string[]) : Word[] {
    return wordList.map((w) => word(w, DUMMY_POSITION));
}

function word(id : string, position : number, value? : string) : Word {
    return { id, value : value ?? id, type : "word", partOfSpeech : "verb", position};
}