import { ProxyManager, replayHistory } from "../../src/util/historyproxy";
import { Chance } from "chance"
import { RandomObjectGenerator } from "../testutils/randomobjectgenerator";
import _ from "lodash"
import { Obj, PropType } from "../../src/util/objects";


/* eslint-disable @typescript-eslint/no-explicit-any */

const MASTER_CHANCE = new Chance();

test("Test set primitives", () => {
    const manager = new ProxyManager(true); 
    const target : {[key:string] : any} = {
        foo : "bar"
    };

    const proxy = manager.createProxy(target);

    proxy.foo = "qux";
    proxy.corge = "xyzzy";

    expect(target).toEqual({foo : "qux", corge : "xyzzy"});
    expect(proxy).toEqual({foo : "qux", corge : "xyzzy"});
    expect(manager.getHistory()).toStrictEqual([set(["foo"], "qux"), set(["corge"],"xyzzy")]);
});

test("Test delete primitive", () => {
    const manager = new ProxyManager(true);
    const target : Obj = {
        foo : "bar",
        baz : "qux"
    }

    const proxy = manager.createProxy(target);

    delete proxy.foo;
    expect(target).toEqual({baz : "qux"});
    expect(proxy).toEqual({baz : "qux"});
    expect(manager.getHistory()).toStrictEqual([del(["foo"])])
});

test("Test object property", () => {
    const manager = new ProxyManager(true);
    const target : Obj = {
        foo : { "bar" : "baz" },
        corge : "xyzzy"
    }

    const proxy = manager.createProxy(target);
    proxy.foo.bar = "grault";
    expect(target).toEqual({ foo : { bar : "grault" }, corge : "xyzzy"});
    expect(proxy).toEqual({ foo : { bar : "grault" }, corge : "xyzzy"});
    expect(manager.getHistory()).toEqual([set(["foo", "bar"], "grault")]);
});

test("Test array setting", () => {
    const manager = new ProxyManager(true);
    const target : Obj = {
        foo : [ "bar", "baz"]
    }
    const proxy = manager.createProxy(target);
    proxy.foo.push("qux");
    expect(manager.getHistory()).toEqual([set(["foo", "2"], "qux"), set(["foo", "length"], 3)]);
});

test("Test deeply nested new object", () => {
    const manager = new ProxyManager(true);
    const original : Obj = {
        foo : {}
    }
    const proxy = manager.createProxy(original);
    proxy.foo.bar = {};
    proxy.foo.bar.baz = {};
    proxy.foo.bar.baz.qux = "xyzzy";

    expect(proxy.foo.bar.baz.qux).toEqual("xyzzy");
    expect(original.foo.bar.baz.qux).toEqual("xyzzy");

    const history = manager.getHistory();

    // Intermediate setting of empty objects should not be stored
    expect(history).toStrictEqual([{"type":"Set","property":["foo","bar","baz","qux"],"newValue":"xyzzy"}]);

    const [newObj, _newManager] = replayHistory({foo : {}}, manager.getHistory());
    expect(newObj.foo.bar.baz.qux).toEqual("xyzzy");
});

test("Test replace string with object", () => {
    const manager = new ProxyManager(true);
    const original : Obj = { foo : "bar" }
    const proxy = manager.createProxy(original);
    proxy.foo = {};
    proxy.foo.bar = "xyzzy";

    expect(proxy.foo.bar).toEqual("xyzzy");
    expect(original.foo.bar).toEqual("xyzzy");

    const history = manager.getHistory();

    // Intermediate setting of empty objects should not be stored
    expect(history).toStrictEqual([
        {"type":"Set","property":["foo"],"newValue":{},"replace":true},
        {"type":"Set","property":["foo","bar"],"newValue":"xyzzy"}]);

    const [newObj, _newManager] = replayHistory({foo : "bar"}, manager.getHistory());
    expect(newObj.foo.bar).toEqual("xyzzy");

})

test("Test store empty object at leaf node", () => {
    const manager = new ProxyManager(true);
    const original : Obj = {
        foo : {}
    }
    const proxy = manager.createProxy(original);
    proxy.foo.bar = {};
    proxy.foo.bar.baz = {};

    expect(proxy.foo.bar.baz).toEqual({});
    expect(original.foo.bar.baz).toEqual({});

    const history = manager.getHistory();

    // Intermediate setting of empty objects should not be stored
    expect(history).toStrictEqual([{"type":"Set","property":["foo","bar","baz"],"newValue":{}}]);

    const [newObj, _newManager] = replayHistory({foo : {}}, manager.getHistory());
    expect(newObj.foo.bar.baz).toEqual({});
});

test("Test replay history", () => {
    const manager = new ProxyManager(true);
    const original : Obj = {};
    const proxy = manager.createProxy(original);
    proxy.foo = "bar";
    proxy.baz = {};

    const theBaz = proxy.baz;

    theBaz.qux = "corge";
    theBaz.grault = "xyzzy";
    delete theBaz.qux;

    theBaz.array = [1,2,3];
    theBaz.array.push(4);

    const [newObj, newManager] = replayHistory({}, manager.getHistory());

    expect(newObj).toEqual(original);
    expect(manager.getHistory()).toEqual(newManager.getHistory());
});

test("Test history compression", () => {
    const manager = new ProxyManager(true);
    const original : Obj = {
        foo : { "bar" : "baz" },
        corge : "xyzzy"
    }

    const proxy = manager.createProxy(original);
    proxy.corge = "one";
    expect(manager.getHistory()).toEqual([set(["corge"], "one")]);

    proxy.corge = "two";
    expect(manager.getHistory()).toEqual([set(["corge"], "two")]);

    proxy.corge = "three";
    expect(manager.getHistory()).toEqual([set(["corge"], "three")]);

    proxy.foo.bar = "qux";
    expect(manager.getHistory()).toEqual([set(["corge"], "three"), set(["foo", "bar"], "qux")]);

    proxy.foo.baz = "quux";
    expect(manager.getHistory()).toEqual([set(["corge"], "three"), set(["foo", "bar"], "qux"), set(["foo", "baz"], "quux")]);

    proxy.foo = "xyzzy";
    expect(manager.getHistory()).toEqual([set(["corge"], "three"), set(["foo"], "xyzzy", true)]);
});

test("Test random objects", () => {
    for(let i=0; i<100; i++) {
        const seed = MASTER_CHANCE.integer();
        const chance = new Chance(seed);

        // Create a new object
        const generator = new RandomObjectGenerator(chance);
        const original = generator.get(10);

        // Keep a copy of the original
        const originalClone = _.cloneDeep(original);

        // Run some random updates
        const manager = new ProxyManager(true);
        const proxy = manager.createProxy(original);
        generator.update(proxy, 10);

        // Should now be different from the original
        expect(original).not.toStrictEqual(originalClone);
        expect(proxy).not.toStrictEqual(originalClone);

        // Replay the history on the original clone
        try {
            const [newObj, _newManager] = replayHistory(originalClone, manager.getHistory());

            // Check the are the same
            expect(newObj, `Seed = [${seed}]`).toStrictEqual(proxy);
        } catch (e) {
            expect(false, `${e} Seed = [${seed}]`).toBeTruthy();
        }
    }
});

function set(property : PropType[], newValue : any, isReplace = false) { 
    const replace = isReplace? { replace : true } : {};
    return { type : "Set", property, newValue, ...replace };
}

function del(property : PropType[]) {
    return { type : "Del", property };
}