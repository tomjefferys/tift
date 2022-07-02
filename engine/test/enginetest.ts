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
    expect(engine.getWords([])).toStrictEqual(["go", "look"]);
    expect(engine.getWords(["go"])).toStrictEqual([]);
    expect(engine.getWords(["eat"])).toStrictEqual([]);
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
    expect(engine.getWords([])).toStrictEqual(["go", "look"]);
    expect(engine.getWords(["go"])).toStrictEqual(["south"]);
    expect(engine.getWords(["go", "south"])).toStrictEqual([]);
    expect(engine.getWords(["eat"])).toStrictEqual([]);
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
    expect(engine.getWords([])).toStrictEqual(["go", "look"]);
    expect(engine.getWords(["go"])).toHaveLength(2);
    expect(engine.getWords(["go"])).toContain("south");
    expect(engine.getWords(["go"])).toContain("east");
    expect(engine.getWords(["go", "south"])).toStrictEqual([]);
    expect(engine.getWords(["go", "east"])).toStrictEqual([]);
    expect(engine.getWords(["eat"])).toStrictEqual([]);
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

    expect(engine.getWords(["go"])).toStrictEqual(["south"]);
    engine.execute(["look"]);
    expect(messages).toEqual(["The room is dark and square","<br/>"]);
    messages.length = 0;
    
    engine.execute(["go", "south"]);
    expect(engine.getWords(["go"])).toStrictEqual(["north"]);
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
        location : "theRoom"
    });
    const engine = builder.build();
    engine.execute(["look"]);
    const look = messages.join(" ");
    expect(look).toContain("An almost empty room");
    expect(look).toContain("an ordinary item");

});

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