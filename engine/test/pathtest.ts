import * as Path from "../src/path";

test("Test isPath", () => {
    const obj1 = [Path.property("abcdef")];
    const obj2 = [Path.index(23)];
    const obj3 = [{"not a " : "path"}];
    expect(Path.isPath(obj1)).toBeTruthy();
    expect(Path.isPath(obj2)).toBeTruthy();
    expect(Path.isPath(obj3)).toBeFalsy();
});

test("Test getPath", () => {
    expect(Path.equals(
                Path.of(["foo", 1, "bar"]),
                [Path.property("foo"), Path.index(1), Path.property("bar")]))
            .toBeTruthy();

    expect(Path.equals(
                Path.of(Path.makePath(["foo", 1, "bar"])),
            [Path.property("foo"), Path.index(1), Path.property("bar")]))
            .toBeTruthy();
})

test("Test getPath mixed types", () => {
    const path = Path.of([Path.namespace("myNS"), "foo", Path.index(1), "bar"]);
    expect(Path.equals( path, [Path.namespace("myNS"), Path.property("foo"), Path.index(1), Path.property("bar")]));
});

test("Test namespace in wrong place", () => {
    expect(() => Path.of(["foo", Path.namespace("myNS")])).toThrow();
});

test("Test concat", () => {
    expect(Path.equals(
                Path.concat(["foo", 1], ["bar", 2]),
                [Path.property("foo"), Path.index(1), Path.property("bar"), Path.index(2)]))
            .toBeTruthy();
    
    expect(Path.equals(
                Path.concat(Path.makePath(["foo", 1]), Path.makePath(["bar", 2])),
                [Path.property("foo"), Path.index(1), Path.property("bar"), Path.index(2)]))
            .toBeTruthy();

    expect(Path.equals(
                Path.concat(Path.makePath(["foo", 1]), ["bar", 2]),
                [Path.property("foo"), Path.index(1), Path.property("bar"), Path.index(2)]))
            .toBeTruthy();

    expect(Path.equals(
                Path.concat(["foo", 1], Path.makePath(["bar", 2])),
                [Path.property("foo"), Path.index(1), Path.property("bar"), Path.index(2)]))
            .toBeTruthy();

    expect(Path.equals( 
                Path.concat(["foo", 1], "bar"),
                [Path.property("foo"), Path.index(1), Path.property("bar")]))
            .toBeTruthy();
    
    expect(Path.equals(
                Path.concat("foo", ["bar", 2]),
                [Path.property("foo"), Path.property("bar"), Path.index(2)]))
            .toBeTruthy();
});

