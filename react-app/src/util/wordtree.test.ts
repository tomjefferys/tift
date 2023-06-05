import { Word } from "tift-types/src/messages/output";
import * as WordTree from "./wordtree"


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
    expect(matches).toStrictEqual([{...word("get down", "down"), tags : ["truncated"]}, word("ball", "ball"), word("bag", "bag")]);
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

    WordTree.addLeaf(root, word("backspace"));

    expect(WordTree.get(root, [])).toStrictEqual(words("push"));
    expect(WordTree.get(root, words("push"))).toStrictEqual(words("box", "chair", "backspace"));
    expect(WordTree.get(root, words("push", "box"))).toStrictEqual(words("north", "south", "backspace"));
    expect(WordTree.get(root, words("push", "chair"))).toStrictEqual(words("east", "west", "backspace"));
});

function words(...wordList : string[]) : Word[] {
    return wordList.map(w => word(w));
}

function word(id : string, value? : string) : Word {
    return { id, value : value ?? id, type : "word", partOfSpeech : "verb"};
}