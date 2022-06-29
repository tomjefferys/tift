import { EngineBuilder } from "../src/enginebuilder";

test("Test single room, no exits", () => {
    const builder = new EngineBuilder();
    builder.withObj({
        id : "northRoom",
        type : "room",
        tags : [ "start" ]
    })
    const engine = builder.build();
    expect(engine.getWords([])).toStrictEqual(["go", "look"]);
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
    expect(engine.getWords([])).toStrictEqual(["go", "look"]);
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
    expect(engine.getWords([])).toStrictEqual(["go", "look"]);
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
        name : "The North Room",
        desc : "The room is dark and square",
        type : "room",
        exits : {
            south : "southRoom"
        },
        tags : [ "start" ]
    })
    builder.withObj({
        id : "southRoom",
        name : "The South Room",
        type : "room",
        exits : {
            north : "northRoom"
        }
    })
    const engine = builder.build();

    expect(engine.getWords(["go"])).toStrictEqual(["south"]);
    engine.execute(["look"]);
    let look = engine.getBuffer().flush().join(" ");
    expect(look).toEqual("The room is dark and square <br/>");
    
    engine.execute(["go", "south"]);
    expect(engine.getWords(["go"])).toStrictEqual(["north"]);
    engine.execute(["look"]);
    look = engine.getBuffer().flush().join(" ");
    expect(look).toEqual("The South Room <br/>");
})

test("Test room with item", () => {
    const builder = new EngineBuilder();
    builder.withObj({
        id : "theRoom",
        name : "The Room",
        desc : "An almost empty room",
        type : "room",
        tags : [ "start" ]
    });
    builder.withObj({
        id : "anItem",
        name : "an ordinary item",
        type : "item",
        location : "theRoom"
    });
    const engine = builder.build();
    engine.execute(["look"]);
    const look = engine.getBuffer().flush().join(" ");
    expect(look).toContain("An almost empty room");
    expect(look).toContain("an ordinary item");

});
