import { Engine } from "../src/engine";
import { EngineBuilder } from "../src/enginebuilder";
import { MessageType, OutputConsumer } from "../src/messages/output";

test("Test single room, no exits", () => {
    const messages : string[] = [];
    const builder = new EngineBuilder().withOutput(listOutputConsumer(messages));
    builder.withObj({
        id : "northRoom",
        type : "room",
        tags : [ "start" ]
    })
    const engine = builder.build();
    expect(getWordIds(engine, [])).toStrictEqual(["go","look"]);
    expect(getWordIds(engine, ["go"])).toStrictEqual([]);
    expect(getWordIds(engine, ["eat"])).toStrictEqual([]);
    expect(messages).toHaveLength(0);
});

test("Test single room, with one exit", () => {
    const messages : string[] = [];
    const builder = new EngineBuilder().withOutput(listOutputConsumer(messages));
    builder.withObj({
        id : "northRoom",
        type : "room",
        exits : {
            south : "southRoom"
        },
        tags : [ "start" ]
    })
    const engine = builder.build();
    expect(getWordIds(engine, [])).toStrictEqual(["go", "look"]);
    expect(getWordIds(engine, ["go"])).toStrictEqual(["south"]);
    expect(getWordIds(engine, ["go", "south"])).toStrictEqual([]);
    expect(getWordIds(engine, ["eat"])).toStrictEqual([]);
    expect(messages).toHaveLength(0);
})

test("Test single room, with two exits", () => {
    const messages : string[] = [];
    const builder = new EngineBuilder().withOutput(listOutputConsumer(messages));
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
    expect(getWordIds(engine, [])).toStrictEqual(["go", "look"]);
    expect(getWordIds(engine, ["go"])).toHaveLength(2);
    expect(getWordIds(engine, ["go"])).toEqual(expect.arrayContaining(["south", "east"]));
    expect(getWordIds(engine, ["go", "south"])).toStrictEqual([]);
    expect(getWordIds(engine, ["go", "east"])).toStrictEqual([]);
    expect(getWordIds(engine, ["eat"])).toStrictEqual([]);
    expect(messages).toHaveLength(0);
})

test("Test two rooms", () => {
    const messages : string[] = [];
    const builder = new EngineBuilder().withOutput(listOutputConsumer(messages));
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

    expect(getWordIds(engine, ["go"])).toStrictEqual(["south"]);
    engine.execute(["look"]);
    expect(messages).toEqual(["The room is dark and square","<br/>"]);
    messages.length = 0;
    
    engine.execute(["go", "south"]);
    expect(getWordIds(engine, ["go"])).toStrictEqual(["north"]);
    engine.execute(["look"]);
    expect(messages).toEqual(["The South Room", "<br/>"]);
})

test("Test room with item", () => {
    const messages : string[] = [];
    const builder = new EngineBuilder().withOutput(listOutputConsumer(messages));
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
        location : "theRoom",
        tags : ["carryable"]
    });
    const engine = builder.build();
    engine.execute(["look"]);
    const look = messages.join(" ");
    expect(look).toContain("An almost empty room");
    expect(look).toContain("an ordinary item");

    const words = getWordIds(engine, []);
    expect(words).toEqual(expect.arrayContaining(["go","look","get"]));
})

test("Test get item", () => {
    const messages : string[] = [];
    const builder = new EngineBuilder().withOutput(listOutputConsumer(messages));
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
        location : "theRoom",
        tags : ["carryable"]
    });

    const engine = builder.build();
    engine.execute(["look"]);
    let look = messages.join(" ");
    messages.length = 0;
    expect(look).toContain("an ordinary item");
    engine.execute(["get","anItem"]);
    engine.execute(["look"]);
    look = messages.join(" ");
    expect(look).not.toContain("an ordinary item");
})

test("Test get named item", () => {
    const messages : string[] = [];
    const builder = new EngineBuilder().withOutput(listOutputConsumer(messages));
    builder.withObj({
        id : "theRoom",
        name : "The Room",
        desc : "An almost empty room",
        type : "room",
        tags : [ "start" ]
    });
    builder.withObj({
        id : "key",
        name : "rusty key",
        type : "item",
        location : "theRoom",
        tags : ["carryable"]
    });
    const engine = builder.build();
    engine.execute(["look"]);
    expect(messages).toContain("rusty key");
    messages.length = 0;

    const words = engine.getWords(["get"]);
    expect(words).toEqual(expect.arrayContaining([{id: "key", value: "rusty key"}]))

    engine.execute(["get", "key"]);

    engine.execute(["look"]);
    expect(messages).not.toContain("rusty key");
})

function listOutputConsumer(messages : string[]) : OutputConsumer {
    return message => {
        switch(message.type) {
            case MessageType.PRINT:
                messages.push(message.value);
                break;
            default:
                throw new Error("Can't handle type " + message.type);
        }
    }
}

function getWordIds(engine : Engine, partial : string[]) : string[] {
    return engine.getWords(partial).map(idWord => idWord.id);
}