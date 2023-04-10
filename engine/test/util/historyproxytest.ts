import { createProxy, replayHistory } from "../../src/util/historyproxy";
import { Chance } from "chance"
import { RandomObjectGenerator } from "../testutils/randomobjectgenerator";
import _ from "lodash"
import { Obj, PropType } from "../../src/util/objects";


/* eslint-disable @typescript-eslint/no-explicit-any */

const MASTER_CHANCE = new Chance();

test("Test set primitives", () => {
    const target : {[key:string] : any} = {
        foo : "bar"
    };

    const [proxy, manager] = createProxy(target, true); 

    proxy.foo = "qux";
    proxy.corge = "xyzzy";

    manager.pushHistory();

    expect(target).toEqual({foo : "qux", corge : "xyzzy"});
    expect(proxy).toEqual({foo : "qux", corge : "xyzzy"});
    expect(manager.getHistory()).toStrictEqual([set(["foo"], "qux"), set(["corge"],"xyzzy")]);
});

test("Test delete primitive", () => {
    const target : Obj = {
        foo : "bar",
        baz : "qux"
    }


    const [proxy, manager] = createProxy(target, true);

    delete proxy.foo;

    manager.pushHistory();

    expect(target).toEqual({baz : "qux"});
    expect(proxy).toEqual({baz : "qux"});
    expect(manager.getHistory()).toStrictEqual([del(["foo"])])
});

test("Test object property", () => {
    const target : Obj = {
        foo : { "bar" : "baz" },
        corge : "xyzzy"
    }

    const [proxy, manager] = createProxy(target, true);
    proxy.foo.bar = "grault";

    manager.pushHistory();

    expect(target).toEqual({ foo : { bar : "grault" }, corge : "xyzzy"});
    expect(proxy).toEqual({ foo : { bar : "grault" }, corge : "xyzzy"});
    expect(manager.getHistory()).toEqual([set(["foo", "bar"], "grault")]);
});

test("Test array setting", () => {
    const target : Obj = {
        foo : [ "bar", "baz"]
    }
    const [proxy, manager] = createProxy(target, true);
    proxy.foo.push("qux");

    manager.pushHistory();

    expect(manager.getHistory()).toEqual([set(["foo", "2"], "qux"), set(["foo", "length"], 3)]);
});

test("Test deeply nested new object", () => {
    const original : Obj = {
        foo : {}
    }
    const [proxy, manager] = createProxy(original, true);
    proxy.foo.bar = {};
    proxy.foo.bar.baz = {};
    proxy.foo.bar.baz.qux = "xyzzy";

    manager.pushHistory();

    expect(proxy.foo.bar.baz.qux).toEqual("xyzzy");
    expect(original.foo.bar.baz.qux).toEqual("xyzzy");

    const history = manager.getHistory();

    // Intermediate setting of empty objects should not be stored
    expect(history).toStrictEqual([{"type":"Set","property":["foo","bar","baz","qux"],"newValue":"xyzzy"}]);

    const [newObj, _newManager] = replayHistory({foo : {}}, manager.getHistory());
    expect(newObj.foo.bar.baz.qux).toEqual("xyzzy");
});

test("Test replace string with object", () => {
    const original : Obj = { foo : "bar" }
    const [proxy, manager] = createProxy(original, true);
    proxy.foo = {};
    proxy.foo.bar = "xyzzy";

    manager.pushHistory();

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
    const original : Obj = {
        foo : {}
    }
    const [proxy, manager] = createProxy(original, true);
    proxy.foo.bar = {};
    proxy.foo.bar.baz = {};

    manager.pushHistory();

    expect(proxy.foo.bar.baz).toEqual({});
    expect(original.foo.bar.baz).toEqual({});

    const history = manager.getHistory();

    // Intermediate setting of empty objects should not be stored
    expect(history).toStrictEqual([{"type":"Set","property":["foo","bar","baz"],"newValue":{}}]);

    const [newObj, _newManager] = replayHistory({foo : {}}, manager.getHistory());
    expect(newObj.foo.bar.baz).toEqual({});
});

test("Test replay history", () => {
    const original : Obj = {};
    const [proxy, manager] = createProxy(original, true);
    proxy.foo = "bar";
    proxy.baz = {};

    const theBaz = proxy.baz;

    theBaz.qux = "corge";
    theBaz.grault = "xyzzy";
    delete theBaz.qux;

    theBaz.array = [1,2,3];
    theBaz.array.push(4);

    manager.pushHistory();

    const [newObj, newManager] = replayHistory({}, manager.getHistory());

    expect(newObj).toEqual(original);
    expect(manager.getHistory()).toEqual(newManager.getHistory());
});

test("Test undo/redo: no history", () => {
    const original : Obj = {};
    const [_proxy, manager] = createProxy(original, true, [], 10);
    expect(manager.isUndoable()).toBeFalsy();
    expect(manager.isRedoable()).toBeFalsy();
});

test("Test undo/redo", () => {
    const original : Obj = {};
    const [proxy, manager] = createProxy(original, true, [], 10);
    proxy.foo = "bar"
    manager.pushHistory();
    proxy.baz = {"qux": "xyzzy"}
    manager.pushHistory();
    proxy.baz.qux = {"corge" : "grualt"};
    manager.pushHistory();

    const expectedHistory = [
        {},
        {"foo" : "bar"},
        {"foo" : "bar", "baz" : { "qux" : "xyzzy" }},
        {"foo" : "bar", "baz" : { "qux" : { "corge" : "grualt"}}}
    ]

    expect(original).toStrictEqual(expectedHistory[3]);

    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeFalsy();
    
    manager.undo();

    expect(proxy).toStrictEqual(expectedHistory[2]);
    expect(original).toStrictEqual(expectedHistory[2]);
    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeTruthy();

    manager.undo();

    expect(proxy).toStrictEqual(expectedHistory[1]);
    expect(original).toStrictEqual(expectedHistory[1]);
    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeTruthy();

    manager.undo();

    expect(proxy).toStrictEqual(expectedHistory[0]);
    expect(original).toStrictEqual(expectedHistory[0]);
    expect(manager.isUndoable()).toBeFalsy();
    expect(manager.isRedoable()).toBeTruthy();

    manager.undo();

    expect(proxy).toStrictEqual(expectedHistory[0]);
    expect(original).toStrictEqual(expectedHistory[0]);

    manager.redo();

    expect(proxy).toStrictEqual(expectedHistory[1]);
    expect(original).toStrictEqual(expectedHistory[1]);
    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeTruthy();

    manager.redo();

    expect(proxy).toStrictEqual(expectedHistory[2]);
    expect(original).toStrictEqual(expectedHistory[2]);
    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeTruthy();

    manager.redo();

    expect(proxy).toStrictEqual(expectedHistory[3]);
    expect(original).toStrictEqual(expectedHistory[3]);
    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeFalsy();

    manager.redo();

    expect(proxy).toStrictEqual(expectedHistory[3]);
    expect(original).toStrictEqual(expectedHistory[3]);

});

test("Test undo/redo: single undo level", () => {
    const original : Obj = {};
    const [proxy, manager] = createProxy(original, true, [], 1);
    proxy.foo = "bar"
    manager.pushHistory();
    proxy.baz = {"qux": "xyzzy"}
    manager.pushHistory();
    proxy.baz.qux = {"corge" : "grualt"};
    manager.pushHistory();

    const expectedHistory = [
        {},
        {"foo" : "bar"},
        {"foo" : "bar", "baz" : { "qux" : "xyzzy" }},
        {"foo" : "bar", "baz" : { "qux" : { "corge" : "grualt"}}}
    ]

    expect(original).toStrictEqual(expectedHistory[3]);

    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeFalsy();
    
    manager.undo();

    expect(proxy).toStrictEqual(expectedHistory[2]);
    expect(original).toStrictEqual(expectedHistory[2]);
    expect(manager.isUndoable()).toBeFalsy();
    expect(manager.isRedoable()).toBeTruthy();

    // Shouldn't be able to undo any further
    manager.undo();

    expect(proxy).toStrictEqual(expectedHistory[2]);
    expect(original).toStrictEqual(expectedHistory[2]);
    expect(manager.isUndoable()).toBeFalsy();
    expect(manager.isRedoable()).toBeTruthy();

    manager.redo();

    expect(proxy).toStrictEqual(expectedHistory[3]);
    expect(original).toStrictEqual(expectedHistory[3]);
    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeFalsy();

    manager.redo();

    expect(proxy).toStrictEqual(expectedHistory[3]);
    expect(original).toStrictEqual(expectedHistory[3]);
    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeFalsy();

});

test("Test undo then change", () => {
    const original : Obj = {};
    const [proxy, manager] = createProxy(original, true, [], 10);
    proxy.foo = "bar"
    manager.pushHistory();
    proxy.baz = {"qux": "xyzzy"}
    manager.pushHistory();
    proxy.baz.qux = {"corge" : "grualt"};
    manager.pushHistory();

    const expectedHistory = [
        {},
        {"foo" : "bar"},
        {"foo" : "bar", "baz" : { "qux" : "xyzzy" }},
        {"foo" : "bar", "baz" : { "qux" : { "corge" : "grualt"}}}
    ]

    expect(original).toStrictEqual(expectedHistory[3]);

    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeFalsy();

    manager.undo();

    expect(proxy).toStrictEqual(expectedHistory[2]);
    
    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeTruthy();

    proxy.foo = "quux";
    manager.pushHistory();

    expect(manager.isUndoable()).toBeTruthy();
    expect(manager.isRedoable()).toBeFalsy();


});

test("Test history compression", () => {
    const original : Obj = {
        foo : { "bar" : "baz" },
        corge : "xyzzy"
    }

    const [proxy, manager] = createProxy(original, true);
    proxy.corge = "one";
    manager.pushHistory();
    expect(manager.getHistory()).toEqual([set(["corge"], "one")]);

    proxy.corge = "two";
    manager.pushHistory();
    expect(manager.getHistory()).toEqual([set(["corge"], "two")]);

    proxy.corge = "three";
    manager.pushHistory();
    expect(manager.getHistory()).toEqual([set(["corge"], "three")]);

    proxy.foo.bar = "qux";
    manager.pushHistory();
    expect(manager.getHistory()).toEqual([set(["corge"], "three"), set(["foo", "bar"], "qux")]);

    proxy.foo.baz = "quux";
    manager.pushHistory();
    expect(manager.getHistory()).toEqual([set(["corge"], "three"), set(["foo", "bar"], "qux"), set(["foo", "baz"], "quux")]);

    proxy.foo = "xyzzy";
    manager.pushHistory();
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
        const [proxy, manager] = createProxy(original, true);
        generator.update(proxy, 10);

        manager.pushHistory();

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