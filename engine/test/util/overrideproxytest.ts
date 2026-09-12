import { createOverridableProxy } from "../../src/util/overrideproxy";
import { Chance } from "chance"
import { RandomObjectGenerator } from "../testutils/randomobjectgenerator";
import _ from "lodash"
import { Obj } from "../../src/util/objects";

const MASTER_CHANCE = new Chance();

test("Test read pass through for unset keys", () => {
    const original : Obj = { foo : "bar", baz : 123 };
    const proxy = createOverridableProxy(original);

    expect(proxy.foo).toEqual("bar");
    expect(proxy.baz).toEqual(123);
});

test("Test set primitive does not affect original", () => {
    const original : Obj = { foo : "bar" };
    const proxy = createOverridableProxy(original);

    proxy.foo = "qux";

    expect(proxy.foo).toEqual("qux");
    expect(original.foo).toEqual("bar");
});

test("Test adding a new key not present on the original", () => {
    const original : Obj = { foo : "bar" };
    const proxy = createOverridableProxy(original);

    proxy.corge = "xyzzy";

    expect(proxy.corge).toEqual("xyzzy");
    expect(original.corge).toBeUndefined();
    expect(original).toStrictEqual({ foo : "bar" });
});

test("Test delete a key", () => {
    const original : Obj = { foo : "bar", baz : "qux" };
    const proxy = createOverridableProxy(original);

    delete proxy.foo;

    expect(proxy.foo).toBeUndefined();
    expect("foo" in proxy).toBeFalsy();
    expect(Object.keys(proxy)).toStrictEqual(["baz"]);

    // Original is untouched
    expect(original).toStrictEqual({ foo : "bar", baz : "qux" });
});

test("Test delete then re-set the same key", () => {
    const original : Obj = { foo : "bar" };
    const proxy = createOverridableProxy(original);

    delete proxy.foo;
    expect(proxy.foo).toBeUndefined();

    proxy.foo = "quux";
    expect(proxy.foo).toEqual("quux");
    expect("foo" in proxy).toBeTruthy();

    expect(original).toStrictEqual({ foo : "bar" });
});

test("Test nested object write merges with sibling keys", () => {
    const original : Obj = { foo : { bar : "baz", other : "unchanged" } };
    const proxy = createOverridableProxy(original);

    proxy.foo.bar = "grault";

    expect(proxy.foo.bar).toEqual("grault");
    expect(proxy.foo.other).toEqual("unchanged");

    // Original untouched
    expect(original.foo.bar).toEqual("baz");
    expect(original.foo.other).toEqual("unchanged");
});

test("Test deep nested write", () => {
    const original : Obj = { foo : { bar : { baz : { qux : "original" } } } };
    const proxy = createOverridableProxy(original);

    proxy.foo.bar.baz.qux = "overridden";

    expect(proxy.foo.bar.baz.qux).toEqual("overridden");
    expect(original.foo.bar.baz.qux).toEqual("original");
});

test("Test replacing an object valued key is a replacement not a merge", () => {
    const original : Obj = { foo : { bar : "baz", other : "value" } };
    const proxy = createOverridableProxy(original);

    proxy.foo = { qux : "new" };

    expect(proxy.foo).toStrictEqual({ qux : "new" });
    expect(original.foo).toStrictEqual({ bar : "baz", other : "value" });
});

test("Test Object.keys, spread and JSON.stringify reflect the merged view", () => {
    const original : Obj = { foo : "bar", baz : "qux" };
    const proxy = createOverridableProxy(original);

    proxy.corge = "new";
    delete proxy.foo;

    expect(Object.keys(proxy).sort()).toStrictEqual(["baz", "corge"]);
    expect({ ...proxy }).toStrictEqual({ baz : "qux", corge : "new" });
    expect(JSON.parse(JSON.stringify(proxy))).toStrictEqual({ baz : "qux", corge : "new" });

    expect(original).toStrictEqual({ foo : "bar", baz : "qux" });
});

test("Test 'in' operator for original, overridden, new and deleted keys", () => {
    const original : Obj = { foo : "bar", baz : "qux" };
    const proxy = createOverridableProxy(original);

    proxy.corge = "new";
    delete proxy.baz;

    expect("foo" in proxy).toBeTruthy();   // untouched original key
    expect("corge" in proxy).toBeTruthy(); // newly added key
    expect("baz" in proxy).toBeFalsy();    // deleted key
    expect("nonexistent" in proxy).toBeFalsy();

    expect(original).toStrictEqual({ foo : "bar", baz : "qux" });
});

test("Test array push is isolated from the original", () => {
    const original : Obj = { list : ["a", "b"] };
    const proxy = createOverridableProxy(original);

    proxy.list.push("c");

    expect(Array.isArray(proxy.list)).toBeTruthy();
    expect(proxy.list.length).toEqual(3);
    expect(Array.from(proxy.list)).toStrictEqual(["a", "b", "c"]);

    expect(original.list).toStrictEqual(["a", "b"]);
});

test("Test array index assignment is isolated from the original", () => {
    const original : Obj = { list : ["a", "b", "c"] };
    const proxy = createOverridableProxy(original);

    proxy.list[1] = "z";

    expect(Array.from(proxy.list)).toStrictEqual(["a", "z", "c"]);
    expect(original.list).toStrictEqual(["a", "b", "c"]);
});

test("Test two proxies over the same target are independent", () => {
    const original : Obj = { foo : "bar" };
    const proxyA = createOverridableProxy(original);
    const proxyB = createOverridableProxy(original);

    proxyA.foo = "changedByA";

    expect(proxyA.foo).toEqual("changedByA");
    expect(proxyB.foo).toEqual("bar");
    expect(original.foo).toEqual("bar");
});

test("Test random objects", () => {
    for(let i=0; i<100; i++) {
        const seed = MASTER_CHANCE.integer();
        const chance = new Chance(seed);

        // Create a new random object, and keep an untouched clone of it
        const generator = new RandomObjectGenerator(chance);
        const original = generator.get(10);
        const originalClone = _.cloneDeep(original);

        // Drive two structurally-identical update sequences from the same seed: one applied
        // directly to a plain clone (the expected result), one applied via the override proxy.
        // Using fresh generators (propCount starting at 0) with identically-seeded Chance
        // instances means both walks make the same sequence of random choices, as long as the
        // proxy's enumeration order matches a plain object's (which it does - see ownKeys).
        const updateSeed = chance.integer();
        const expected = _.cloneDeep(original);
        new RandomObjectGenerator(new Chance(updateSeed)).update(expected, 10);

        const proxy = createOverridableProxy(original);
        new RandomObjectGenerator(new Chance(updateSeed)).update(proxy, 10);

        try {
            // The override proxy's view should match the same updates applied to a plain object...
            expect(proxy, `Seed = [${seed}]`).toStrictEqual(expected);
            // ...while the real underlying object must remain completely untouched.
            expect(original, `Seed = [${seed}]`).toStrictEqual(originalClone);
        } catch (e) {
            expect(false, `${e} Seed = [${seed}]`).toBeTruthy();
        }
    }
});
