import { Word } from "tift-types/src/messages/output";
import { handleKeyboardInput } from "./keyboardhandler";
import { BACKSPACE } from "./util";

test("Test keyboard handler", () => {
    const e : KeyboardEvent = new KeyboardEvent("KeyDown", {
        key : "g"
    });
    const result = handleKeyboardInput("", [word("get"), word("give"), word("drop")], e);
    expect(result.partial).toBe("g");
    expect(result.selected).toBeUndefined();
    expect(result.filtered).toStrictEqual([word("get"), word("give")]);
});

test("Test keyboard handler - autocomplete", () => {
    const e : KeyboardEvent = new KeyboardEvent("KeyDown", { key : " " });
    const result = handleKeyboardInput("d", [word("get"), word("give"), word("drop")], e);
    expect(result.partial).toBe("");
    expect(result.selected).toStrictEqual(word("drop"));
    expect(result.filtered).toStrictEqual([word("drop")]);
});

test("Test keyboard handler - autocomplete with multiple matches", () => {
    const e : KeyboardEvent = new KeyboardEvent("KeyDown", { key : " " });
    const result = handleKeyboardInput("m", [word("midday"), word("midnight"), word("afternoon")], e);
    expect(result.partial).toBe("mid");
    expect(result.selected).toBeUndefined();
    expect(result.filtered).toStrictEqual([word("midday"), word("midnight")]);
});

test("Test keyboard handler - test backspace with partial word", () => {
    const e : KeyboardEvent = new KeyboardEvent("KeyDown", {
        key : "Backspace"
    });
    const result = handleKeyboardInput("dro", [word("get"), word("give"), word("drop")], e);
    expect(result.partial).toBe("dr");
    expect(result.selected).toBeUndefined();
    expect(result.filtered).toStrictEqual([word("drop")]);
});

test("Test keyboard handler - test backspace with complete word", () => {
    const e : KeyboardEvent = new KeyboardEvent("KeyDown", {
        key : "Backspace"
    });
    const result = handleKeyboardInput("", [word("ball"), word("stick")], e);
    expect(result.partial).toBe("");
    expect(result.selected).toStrictEqual(BACKSPACE);
    expect(result.filtered).toStrictEqual([word("ball"), word("stick")]);
})



const word = (value : string) : Word => ({id : value, value, type : "word", partOfSpeech : "verb"})