import * as Arrays from "../../src/util/arrays"

test("Test prefix equals", () => {
    expect(Arrays.prefixEquals(["eat", "apple"], [])).toBe(true);
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat"])).toBe(true)
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat", "apple"])).toBe(true);
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat", "apple", "carefully"])).toBe(true);
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat", "bread"])).toBe(false);
});

test("Test isPrefixOf", () => {
    expect(Arrays.isPrefixOf([], [])).toBe(true);
    expect(Arrays.isPrefixOf([], ["one"])).toBe(true);
    expect(Arrays.isPrefixOf([], ["one","two"])).toBe(true);
    expect(Arrays.isPrefixOf(["one"], [])).toBe(false);
    expect(Arrays.isPrefixOf(["one"], ["one"])).toBe(true);
    expect(Arrays.isPrefixOf(["one"], ["one", "two", "three"])).toBe(true);
    expect(Arrays.isPrefixOf(["one", "two"], [])).toBe(false);
    expect(Arrays.isPrefixOf(["one", "two"], ["one"])).toBe(false);
    expect(Arrays.isPrefixOf(["one", "two"], ["one", "two"])).toBe(true);
    expect(Arrays.isPrefixOf(["one", "two"], ["one", "two", "three"])).toBe(true);
});