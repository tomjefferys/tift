import * as Arrays from "../../src/util/arrays"

test("Test prefix equals", () => {
    expect(Arrays.prefixEquals(["eat", "apple"], [])).toBe(true);
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat"])).toBe(true)
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat", "apple"])).toBe(true);
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat", "apple", "carefully"])).toBe(true);
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat", "bread"])).toBe(false);
});