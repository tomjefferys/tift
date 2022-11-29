import { ProxyManager, replayHistory } from "../../src/util/historyproxy";
import { Chance } from "chance"
import { RandomObjectGenerator } from "../testutils/randomobjectgenerator";
import _ from "lodash"


/* eslint-disable @typescript-eslint/no-explicit-any */

const MASTER_CHANCE = new Chance();

type PropType = string | symbol;

type Obj = {[key:PropType] : any};

test("Test set primitives", () => {
    const manager = new ProxyManager(); 
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
    const manager = new ProxyManager();
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
    const manager = new ProxyManager();
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
    const manager = new ProxyManager();
    const target : Obj = {
        foo : [ "bar", "baz"]
    }
    const proxy = manager.createProxy(target);
    proxy.foo.push("qux");
    expect(manager.getHistory()).toEqual([set(["foo", "2"], "qux"), set(["foo", "length"], 3)]);
})

test("Test replay history", () => {
    const manager = new ProxyManager();
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
    const manager = new ProxyManager();
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
    expect(manager.getHistory()).toEqual([set(["corge"], "three"), set(["foo"], "xyzzy")]);
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
        const manager = new ProxyManager();
        const proxy = manager.createProxy(original);
        generator.update(proxy, 10);

        // Should now be different from the original
        expect(original).not.toStrictEqual(originalClone);
        expect(proxy).not.toStrictEqual(originalClone);

        // Replay the history on the original clone
        const [newObj, _newManager] = replayHistory(originalClone, manager.getHistory());

        // Check the are the same
        expect(newObj, "Seed = [" + seed + "]").toStrictEqual(proxy);
    }
});

function set(property : PropType[], newValue : any) { 
    return { type : "Set", property, newValue };
}

function del(property : PropType[]) {
    return { type : "Del", property };
}