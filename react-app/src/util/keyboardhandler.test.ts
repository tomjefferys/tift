import { Word } from "tift-types/src/messages/word";
import { handleKeyboardInput } from "./keyboardhandler";
import { BACKSPACE } from "./util";

test("Test keyboard handler", () => {
    const e = keyEvent("g");
    const result = handleKeyboardInput("", [word("get"), word("give"), word("drop")], e);
    expect(result.partial).toBe("g");
    expect(result.selected).toBeUndefined();
    expect(result.filtered).toStrictEqual([word("get"), word("give")]);
});

test("Test keyboard handler - autocomplete", () => {
    const e = keyEvent(" ");
    const result = handleKeyboardInput("d", [word("get"), word("give"), word("drop")], e);
    expect(result.partial).toBe("");
    expect(result.selected).toStrictEqual(word("drop"));
    expect(result.filtered).toStrictEqual([word("drop")]);
});

test("Test keyboard handler - autocomplete with multiple matches", () => {
    const e = keyEvent(" ");
    const result = handleKeyboardInput("m", [word("midday"), word("midnight"), word("afternoon")], e);
    expect(result.partial).toBe("mid");
    expect(result.selected).toBeUndefined();
    expect(result.filtered).toStrictEqual([word("midday"), word("midnight")]);
});

test("Test keyboard handler - autocomplete with multiple matches - no new partial", () => {
    const result = handleKeyboardInput("a", [word("Apple core"), word("abacus")], keyEvent(" "));
    expect(result.partial).toBe("A");
    expect(result.selected).toBeUndefined();
    expect(result.filtered).toStrictEqual([word("Apple core"), word("abacus")]);
});

test("Test keyboard handler - test backspace with partial word", () => {
    const e = keyEvent("Backspace");
    const result = handleKeyboardInput("dro", [word("get"), word("give"), word("drop")], e);
    expect(result.partial).toBe("dr");
    expect(result.selected).toBeUndefined();
    expect(result.filtered).toStrictEqual([word("drop")]);
});

test("Test keyboard handler - test backspace with complete word", () => {
    const e = keyEvent("Backspace");
    const result = handleKeyboardInput("", [word("ball"), word("stick")], e);
    expect(result.partial).toBe("");
    expect(result.selected).toStrictEqual(BACKSPACE);
    expect(result.filtered).toStrictEqual([word("ball"), word("stick")]);
})

test("Test keyboard handler - test uppercase letters", () => {
    const e = keyEvent("a");
    const result = handleKeyboardInput("", [word("Apple"), word("aardvark")], e);
    expect(result.partial).toBe("a");
    expect(result.selected).toBeUndefined();
    expect(result.filtered).toStrictEqual([word("Apple"), word("aardvark")]);

    const e2 = keyEvent("p");
    const result2 = handleKeyboardInput("a", [word("Apple"), word("aardvark")], e2);
    expect(result2.partial).toBe("ap");
    expect(result2.selected).toBeUndefined();
    expect(result2.filtered).toStrictEqual([word("Apple")]);
}); 

test("Test keyboard handler - test capitalized word - autocomplete", () => {
    const e = keyEvent(" ");
    const result = handleKeyboardInput("a", [word("Apple")], e);
    expect(result.partial).toBe("");
    expect(result.selected).toStrictEqual(word("Apple"));
    expect(result.filtered).toStrictEqual([word("Apple")]);
})

test("Test keyboard handler - test capitalized phrase", () => {
    const e = keyEvent(" ");
    const result = handleKeyboardInput("Bo", [word("Boris the scribe"), word("BACKSPACE")], e);
    expect(result.partial).toBe("");
    expect(result.selected).toStrictEqual(word("Boris the scribe"));
    expect(result.filtered).toStrictEqual([word("Boris the scribe")]);
});

const keyEvent = (key : string) : KeyboardEvent => new KeyboardEvent("KeyDown", { key });

const word = (value : string) : Word => ({id : value, value, type : "word", partOfSpeech : "verb", position : 1})