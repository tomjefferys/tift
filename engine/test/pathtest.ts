import { index, isPath, property } from "../src/path";


test("Test isPath", () => {
    const obj1 = [property("abcdef")];
    const obj2 = [index(23)];
    const obj3 = [{"not a " : "path"}];
    expect(isPath(obj1)).toBeTruthy();
    expect(isPath(obj2)).toBeTruthy();
    expect(isPath(obj3)).toBeFalsy();
});