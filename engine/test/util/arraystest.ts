import * as Arrays from "../../src/util/arrays"

test("Test prefix equals", () => {
    expect(Arrays.prefixEquals(["eat", "apple"], [])).toBe(true);
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat"])).toBe(true)
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat", "apple"])).toBe(true);
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat", "apple", "carefully"])).toBe(true);
    expect(Arrays.prefixEquals(["eat", "apple"], ["eat", "bread"])).toBe(false);
});

test("Test wildcard prefix equals", () => {
    expect(Arrays.wildcardPrefixEquals(["eat", "apple"], [], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["eat", "apple"], ["eat"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["eat", "apple"], ["eat", "apple"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["eat", "apple"], ["*"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["eat", "apple"], ["*", "*"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["*", "apple"], ["eat"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["eat", "*"], ["eat", "apple"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["*", "apple"], ["*"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["*", "*"], ["*", "*"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["eat", "apple"], ["eat", "apple", "carefully"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["eat", "apple"], ["eat", "apple", "*"], "*")).toBe(true);
    expect(Arrays.wildcardPrefixEquals(["eat", "apple"], ["eat", "bread"], "*")).toBe(false);
    expect(Arrays.wildcardPrefixEquals(["eat", "apple"], ["*", "bread"], "*")).toBe(false);
    expect(Arrays.wildcardPrefixEquals(["*", "apple"], ["eat", "bread"], "*")).toBe(false);
    expect(Arrays.wildcardPrefixEquals(["*", "apple"], ["*", "bread"], "*")).toBe(false);
    expect(Arrays.wildcardPrefixEquals(["eat", "*"], ["eat", "bread"], "*")).toBe(true);
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

test("Test filterInPlace", () => {
    const isOdd = (n : number) => Boolean(n % 2);
    let arr : number[] = [];
    Arrays.keep(arr, isOdd);
    expect(arr).toStrictEqual([]);

    arr = [1,2,3,4];
    Arrays.keep(arr, isOdd);
    expect(arr).toStrictEqual([1,3]);

    arr = [1,3,5,7];
    Arrays.keep(arr, isOdd);
    expect(arr).toStrictEqual([1,3,5,7]);

    arr = [2,4,6,8];
    Arrays.keep(arr, isOdd);
    expect(arr).toStrictEqual([]);
})

test("Test removeAll", () => {
    const isOdd = (n : number) => Boolean(n % 2);
    let arr : number[] = [];
    Arrays.remove(arr, isOdd);
    expect(arr).toStrictEqual([]);

    arr = [1,2,3,4];
    Arrays.remove(arr, isOdd);
    expect(arr).toStrictEqual([2,4]);

    arr = [1,3,5,7];
    Arrays.remove(arr, isOdd);
    expect(arr).toStrictEqual([]);

    arr = [2,4,6,8];
    Arrays.remove(arr, isOdd);
    expect(arr).toStrictEqual([2,4,6,8]);
})