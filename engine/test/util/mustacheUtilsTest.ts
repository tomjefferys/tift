import { formatEntityString } from "../../src/util/mustacheUtils";
import { createRootEnv } from "../../src/env";
import { defaultOutputConsumer } from "../testutils/testutils";
import { EngineBuilder } from "../../src/enginebuilder";
import { Input } from "../../src/main";

test("Test formatEntityString", () => {
    const env = createRootEnv({ "entities" : { "foo" : "bar", "baz" : "qux"}}, "readonly", [["entities"]]);
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