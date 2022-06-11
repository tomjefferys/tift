import { createTextBuffer } from "../src/textbuffer";

test("test text buffer", () => {
    const buffer = createTextBuffer();
    buffer.write("one");
    buffer.write("two");

    expect(buffer.flush()).toEqual(["one", "two"]);
    expect(buffer.flush()).toEqual([]);

    buffer.write("three");
    expect(buffer.flush()).toEqual(["three"]);
    expect(buffer.flush()).toEqual([]);
})