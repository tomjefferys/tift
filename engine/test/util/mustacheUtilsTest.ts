import { formatString } from "../../src/util/mustacheUtils";
import { createRootEnv } from "../../src/env";
import { defaultOutputConsumer, loadDefaults } from "../testutils/testutils";
import { EngineBuilder } from "../../src/builder/enginebuilder";
import { Input } from "../../src/main";
import _ from "lodash";
import { GAME_METADATA, NORTH_ROOM } from "../testutils/testobjects";

test("Test formatEntityString", () => {
    const env = createRootEnv({ "entities" : { "foo" : "bar", "baz" : "qux"}}, [["entities"]]);
    const entity = {
        "foo" : "corge",
        "description" : "Foo: {{foo}}, Baz: {{baz}}"
    };

    const scope = env.newChild(env.createNamespaceReferences(["entities"]));

    const result = formatString(scope, entity["description"], [entity, "description"]);
    expect(result).toEqual("Foo: corge, Baz: qux");
});

test("Test formatEntityString when looking and using same entity", () => {
    const room1 = {
        id : "theRoom1",
        name : "The Room",
        description : "An almost empty room {{detail}}",
        detail : "except for a flickering light",
        type : "room",
        tags : [ "start" ]
    };

    const [consumer, messages, _words] = defaultOutputConsumer();

    const builder = new EngineBuilder()
                            .withOutput(consumer)
                            .withObj(GAME_METADATA)
                            .withObj(room1);
    loadDefaults(builder);
    const engine = builder.build();
    engine.send(Input.start());
    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room except for a flickering light");
});

test("Test formatEntityString when looking with different entity", () => {
    const room1 = {
        id : "theRoom1",
        name : "The Room",
        description : "An almost empty room {{detail}} from here you can see {{theRoom2.name}}",
        detail : "except for a flickering light",
        type : "room",
        tags : [ "start" ]
    };

    const room2 = {
        id : "theRoom2",
        name : "Another Room",
        description : "A room full to the brim with brikabrack",
        type : "room",
    }

    const [consumer, messages, _words] = defaultOutputConsumer();

    const builder = new EngineBuilder()
                            .withOutput(consumer)
                            .withObj(GAME_METADATA)
                            .withObj(room1)
                            .withObj(room2);
    loadDefaults(builder);
    const engine = builder.build();

    engine.send(Input.start());
    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room except for a flickering light from here you can see Another Room");
});

test("Test choose", () => {
    const env = createRootEnv({ "entities" : { "foo" : "bar", "baz" : "qux"}}, [["entities"]]);
    const entity = {
        "foo" : "corge",
        "description" : "{{#choose}}{{foo}}||{{baz}}{{/choose}}"
    };
    const scope = env.newChild(env.createNamespaceReferences(["entities"]));
    const result = formatString(scope, entity["description"], [entity, "description"]);
    expect(["corge","qux"]).toContain(result);
});

test("Test firstTime", () => {
    const room1 = {
        id : "theRoom1",
        name : "The Room",
        description : "{{#firstTime}}The floor creaks as you enter the almost empty room{{/firstTime}}{{^firstTime}}An almost empty room{{/firstTime}}, there is a black cat here.",
        type : "room",
        tags : [ "start" ]
    };

    const [consumer, messages, _words, saveData] = defaultOutputConsumer();
    const builder = new EngineBuilder()
                            .withOutput(consumer)
                            .withObj(GAME_METADATA)
                            .withObj(room1)
                            .withConfigEntry("undoLevels", 0);
    loadDefaults(builder);
    const engine = builder.build();
    engine.send(Input.start());
    expect(saveData.data.baseHistory).toStrictEqual([]);

    engine.send(Input.execute(["look"]));
    engine.send(Input.execute(["wait"]));
    expect(messages.join(" ")).toContain("The floor creaks as you enter the almost empty room, there is a black cat here.");
    expect(_.get(saveData, 'data.baseHistory[0].property')).toStrictEqual(["entities", "theRoom1", "__COUNT(description)__"]);
    expect(_.get(saveData, 'data.baseHistory[0].newValue')).toStrictEqual(1);
    messages.length = 0;

    engine.send(Input.execute(["look"]));
    engine.send(Input.execute(["wait"]));
    expect(messages.join(" ")).toContain("An almost empty room, there is a black cat here.");
    expect(_.get(saveData, 'data.baseHistory[0].property')).toStrictEqual(["entities", "theRoom1", "__COUNT(description)__"]);
    expect(_.get(saveData, 'data.baseHistory[0].newValue')).toStrictEqual(2);
    messages.length = 0;

    engine.send(Input.execute(["look"]));
    engine.send(Input.execute(["wait"]));
    expect(messages.join(" ")).toContain("An almost empty room, there is a black cat here.");
    expect(_.get(saveData, 'data.baseHistory[0].property')).toStrictEqual(["entities", "theRoom1", "__COUNT(description)__"]);
    expect(_.get(saveData, 'data.baseHistory[0].newValue')).toStrictEqual(3);
});

test("Test not needlessy updating state", () => {
    const room1 = {
        id : "theRoom1",
        name : "The Room",
        description : "An almost empty room, there is a black cat here.",
        type : "room",
        tags : [ "start" ]
    };

    const [consumer, messages, _words, saveData] = defaultOutputConsumer();
    const builder = new EngineBuilder()
                            .withOutput(consumer)
                            .withObj(GAME_METADATA)
                            .withObj(room1)
                            .withConfigEntry("undoLevels", 0);
    loadDefaults(builder);
    const engine = builder.build();

    engine.send(Input.start());
    expect(saveData.data.baseHistory).toStrictEqual([]);

    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room, there is a black cat here.");
    expect(saveData.data.baseHistory).toStrictEqual([]);
    messages.length = 0;

    engine.send(Input.execute(["look"]));
    expect(messages.join(" ").trim()).toEqual("An almost empty room, there is a black cat here.");
    expect(saveData.data.baseHistory).toStrictEqual([]);
    messages.length = 0;
})

test("Test can call user defined function from mustache", () => {
    const builder = new EngineBuilder();
    builder.withObj({ ...NORTH_ROOM })
           .withObj(GAME_METADATA)
           .withObj({
            id : "switch",
            type : "item",
            description : "The switch is {{#isOn}}ON{{/isOn}}{{^isOn}}OFF{{/isOn}}",
            location : "northRoom",
            name : "switch",
            state : "off",
            "isOn()" : "state == 'on'",
            verbs : ["toggle"]
           })
           .withObj({
            id : "toggle",
            type : "verb",
            tags : ["transitive"],
            actions : {
                "toggle($switch)" : {
                    "if" : "switch.state == 'on'",
                    "then" : "switch.state = 'off'",
                    "else" : "switch.state = 'on'"
                }
            }
           });

    const [consumer, messages, _words, _saveData] = defaultOutputConsumer();
    builder.withOutput(consumer);
    loadDefaults(builder);
    const engine = builder.build();

    engine.send(Input.start());

    engine.send(Input.execute(["look"]));
    engine.send(Input.execute(["examine", "switch"]));
    expect(messages.join(" ")).toContain("The switch is OFF");
    expect(messages.join(" ")).not.toContain("The switch is ON");
    messages.length = 0;

    engine.send(Input.execute(["toggle", "switch"]));
    engine.send(Input.execute(["examine", "switch"]));
    expect(messages.join(" ")).toContain("The switch is ON");
    expect(messages.join(" ")).not.toContain("The switch is OFF");

});

test("Test format sentence", () => {
    const env = createRootEnv({ "FOO" : "foo", 
                                "BAR" : "Bar",
                                "QUESTION" : "question?",
                                "EXCLAMATION" : "exclamation!",
                                "STOP" : "stop."});
                    
    expect(formatString(env, "{{#sentence}}{{FOO}} is a {{BAR}}{{/sentence}}")).toEqual("Foo is a Bar.");
    expect(formatString(env, "{{#sentence}}{{BAR}} is a {{FOO}}{{/sentence}}")).toEqual("Bar is a foo.");
    expect(formatString(env, "{{#sentence}}  {{FOO}} is a {{BAR}}  {{/sentence}}")).toEqual("Foo is a Bar.");
    expect(formatString(env, "{{#sentence}}{{/sentence}}")).toEqual("");
    expect(formatString(env, "{{#sentence}}{{FOO}} is a {{BAR}}.{{/sentence}}")).toEqual("Foo is a Bar.");
    expect(formatString(env, "{{#sentence}}{{FOO}} is a {{BAR}}?{{/sentence}}")).toEqual("Foo is a Bar?");
    expect(formatString(env, "{{#sentence}}{{FOO}} is a {{BAR}}!{{/sentence}}")).toEqual("Foo is a Bar!");
    expect(formatString(env, "{{#sentence}}{{FOO}} is a {{QUESTION}}{{/sentence}}")).toEqual("Foo is a question?");
    expect(formatString(env, "{{#sentence}}{{FOO}} is a {{EXCLAMATION}}  {{/sentence}}")).toEqual("Foo is a exclamation!");
    expect(formatString(env, "{{#sentence}}  {{FOO}} is a {{STOP}} {{/sentence}}")).toEqual("Foo is a stop.");
});

