import { formatEntityString } from "../../src/util/mustacheUtils";
import { createRootEnv } from "../../src/env";
import { defaultOutputConsumer } from "../testutils/testutils";
import { EngineBuilder } from "../../src/builder/enginebuilder";
import { Input } from "../../src/main";
import _ from "lodash";

test("Test formatEntityString", () => {
    const env = createRootEnv({ "entities" : { "foo" : "bar", "baz" : "qux"}}, [["entities"]]);
    const entity = {
        "foo" : "corge",
        "desc" : "Foo: {{foo}}, Baz: {{baz}}"
    };

    const result = formatEntityString(env, entity, "desc");
    expect(result).toEqual("Foo: corge, Baz: qux");
});

test("Test formatEntityString when looking and using same entity", () => {
    const room1 = {
        id : "theRoom1",
        name : "The Room",
        desc : "An almost empty room {{detail}}",
        detail : "except for a flickering light",
        type : "room",
        tags : [ "start" ]
    };

    const [consumer, messages, _words] = defaultOutputConsumer();

    const engine = new EngineBuilder()
                            .withOutput(consumer)
                            .withObj(room1)
                            .build();
    engine.send(Input.start());
    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room except for a flickering light");
});

test("Test formatEntityString when looking with different entity", () => {
    const room1 = {
        id : "theRoom1",
        name : "The Room",
        desc : "An almost empty room {{detail}} from here you can see {{theRoom2.name}}",
        detail : "except for a flickering light",
        type : "room",
        tags : [ "start" ]
    };

    const room2 = {
        id : "theRoom2",
        name : "Another Room",
        desc : "A room full to the brim with brikabrack",
        type : "room",
    }

    const [consumer, messages, _words] = defaultOutputConsumer();

    const engine = new EngineBuilder()
                            .withOutput(consumer)
                            .withObj(room1)
                            .withObj(room2)
                            .build();

    engine.send(Input.start());
    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room except for a flickering light from here you can see Another Room");
});

test("Test choose", () => {
    const env = createRootEnv({ "entities" : { "foo" : "bar", "baz" : "qux"}}, [["entities"]]);
    const entity = {
        "foo" : "corge",
        "desc" : "{{#choose}}{{foo}}||{{baz}}{{/choose}}"
    };

    const result = formatEntityString(env, entity, "desc");
    expect(["corge","qux"]).toContain(result);
});

test("Test firstTime", () => {
    const room1 = {
        id : "theRoom1",
        name : "The Room",
        desc : "{{#firstTime}}The floor creaks as you enter the almost empty room{{/firstTime}}{{^firstTime}}An almost empty room{{/firstTime}}, there is a black cat here.",
        type : "room",
        tags : [ "start" ]
    };

    const [consumer, messages, _words, saveData] = defaultOutputConsumer();
    const engine = new EngineBuilder()
                            .withOutput(consumer)
                            .withObj(room1)
                            .withConfigEntry("undoLevels", 0)
                            .build();
    engine.send(Input.start());
    expect(saveData.data).toStrictEqual([]);

    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("The floor creaks as you enter the almost empty room, there is a black cat here.");
    expect(_.get(saveData, 'data[0].property')).toStrictEqual(["entities", "theRoom1", "__LOOK_COUNT__"]);
    expect(_.get(saveData, 'data[0].newValue')).toStrictEqual(1);
    messages.length = 0;

    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room, there is a black cat here.");
    expect(_.get(saveData, 'data[0].property')).toStrictEqual(["entities", "theRoom1", "__LOOK_COUNT__"]);
    expect(_.get(saveData, 'data[0].newValue')).toStrictEqual(2);
    messages.length = 0;

    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room, there is a black cat here.");
    expect(_.get(saveData, 'data[0].property')).toStrictEqual(["entities", "theRoom1", "__LOOK_COUNT__"]);
    expect(_.get(saveData, 'data[0].newValue')).toStrictEqual(3);
});

test("Test not needlessy updating state", () => {
    const room1 = {
        id : "theRoom1",
        name : "The Room",
        desc : "An almost empty room, there is a black cat here.",
        type : "room",
        tags : [ "start" ]
    };

    const [consumer, messages, _words, saveData] = defaultOutputConsumer();
    const engine = new EngineBuilder()
                            .withOutput(consumer)
                            .withObj(room1)
                            .build();
    engine.send(Input.start());
    expect(saveData.data).toStrictEqual([]);

    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room, there is a black cat here.");
    expect(saveData.data).toStrictEqual([]);
    messages.length = 0;

    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room, there is a black cat here.");
    expect(saveData.data).toStrictEqual([]);
    messages.length = 0;
})

