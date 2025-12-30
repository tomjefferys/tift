import { describe, test, expect } from "vitest";
import { createWordFilter } from "../src/wordfilter";
import { Word } from "tift-types/src/messages/word";

describe("Word Filter Tests", () => {
    test("should filter words by prefix", () => {
        const input: Word[] = [
            word("apple"),
            word("banana"),
            word("apricot"),
        ];
        const prefix = "ap".split("");
        const filterFn = createWordFilter({});
        const result = filterFn(input, prefix).map(w => w.value);
        const expected = ["apple", "apricot"];
        expect(result).toEqual(expected);
    });

    test("should apply special patterns", () => {
        const input: Word[] = [
            word("examine"),
            word("execute"),
            word("exit"),
        ];
        const prefix = "x".split("");
        const specialPatterns = { "x": "ex" };
        const filterFn = createWordFilter(specialPatterns);
        const result = filterFn(input, prefix).map(w => w.value);
        const expected = ["examine", "execute", "exit"];
        expect(result).toEqual(expected);
    });

    test("should return empty array if no matches", () => {
        const input: Word[] = [
            word("cat"),
            word("dog"),
            word("fish"),
        ];
        const prefix = "z".split("");
        const filterFn = createWordFilter({});
        const result = filterFn(input, prefix).map(w => w.value);
        const expected: string[] = [];
        expect(result).toEqual(expected);
    });

    test("should return all words for empty prefix", () => {
        const input: Word[] = [
            word("red"),
            word("green"),
            word("blue"),
        ];
        const prefix: string[] = [];
        const filterFn = createWordFilter({});
        const result = filterFn(input, prefix).map(w => w.value);
        const expected = ["red", "green", "blue"];
        expect(result).toEqual(expected);
    });

    test("should handle exact match flag", () => {
        const input: Word[] = [
            word("look"),
            word("lookout"),
            word("looking"),
        ];
        const prefix = "look".split("");
        const filterFn = createWordFilter({});
        const result = filterFn(input, prefix, true).map(w => w.value);
        const expected = ["look"];
        expect(result).toEqual(expected);
    });
});

function word(value : string) : Word {
    return { 
        type: "word",
        partOfSpeech: "verb", 
        position: 0,
        id: value, 
        value };
}