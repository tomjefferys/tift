import { getName, getFullName } from "../src/nameable";

test("getName id only", () => {
    const item = { "id" : "big_square" };
    expect(getName(item)).toEqual("big_square");
});

test("getName with name", () => {
    const item = { "id" : "big_square", "name" : "Big Square" };
    expect(getName(item)).toEqual("Big Square");
});

test("getFullName id only", () => {
    const item = { "id" : "big_square" };
    expect(getFullName(item)).toEqual("the big_square");
}); 

test("getFullName with name", () => {
    const item = { "id" : "big_square", "name" : "Big Square" };
    expect(getFullName(item)).toEqual("the Big Square");
});

test("getFullName with article", () => { 
    const item = { "id" : "big_square", "name" : "Big Square", "article" : "a" };
    expect(getFullName(item)).toEqual("a Big Square");
});