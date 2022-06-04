import { EngineBuilder } from "../src/enginebuilder";
import { Engine } from "../src/engine";
import { EntityBuilder } from "../src/entity";

test("Test single room, no exits", () => {
    const builder = new EngineBuilder();
    builder.withObj({
        id : "northRoom",
        type : "room",
        tags : [ "start" ]
    })
    const engine = builder.build();
    expect(engine.getWords([])).toStrictEqual(["go"]);
    expect(engine.getWords(["go"])).toStrictEqual([]);
    expect(engine.getWords(["eat"])).toStrictEqual([]);
});

test("Test single room, with one exit", () => {
    const builder = new EngineBuilder();
    builder.withObj({
        id : "northRoom",
        type : "room",
        exits : {
            south : "southRoom"
        },
        tags : [ "start" ]
    })
    const engine = builder.build();
    expect(engine.getWords([])).toStrictEqual(["go"]);
    expect(engine.getWords(["go"])).toStrictEqual(["south"]);
    expect(engine.getWords(["go", "south"])).toStrictEqual([]);
    expect(engine.getWords(["eat"])).toStrictEqual([]);
})

test("Test single room, with two exits", () => {
    const builder = new EngineBuilder();
    builder.withObj({
        id : "northRoom",
        type : "room",
        exits : {
            south : "southRoom",
            east : "eastRoom"
        },
        tags : [ "start" ]
    })
    const engine = builder.build();
    expect(engine.getWords([])).toStrictEqual(["go"]);
    expect(engine.getWords(["go"])).toHaveLength(2);
    expect(engine.getWords(["go"])).toContain("south");
    expect(engine.getWords(["go"])).toContain("east");
    expect(engine.getWords(["go", "south"])).toStrictEqual([]);
    expect(engine.getWords(["go", "east"])).toStrictEqual([]);
    expect(engine.getWords(["eat"])).toStrictEqual([]);
})

test("Test two rooms", () => {
    const builder = new EngineBuilder();
    builder.withObj({
        id : "northRoom",
        type : "room",
        exits : {
            south : "southRoom"
        },
        tags : [ "start" ]
    })
    builder.withObj({
        id : "southRoom",
        type : "room",
        exits : {
            north : "northRoom"
        }
    })
    const engine = builder.build();

    expect(engine.getWords(["go"])).toStrictEqual(["south"]);
    engine.execute(["go", "south"]);
    expect(engine.getWords(["go"])).toStrictEqual(["north"]);
})