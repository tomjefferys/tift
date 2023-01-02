import { EngineBuilder } from "../src/enginebuilder";
import { getEngine, Input, OutputConsumerBuilder } from "../src/main";
import { Consumer } from "../src/util/functions";
import { Forwarder } from "../src/util/duplexproxy";
import { NORTH_ROOM, SOUTH_ROOM } from "./testutils/testobjects";
import * as Output from "../src/messages/output";
import { createWordFilter, createEngineProxy, MessageForwarder } from "../src/engineproxy";
import { Engine } from "../src/engine";
import _ from "lodash";
import dedent from "dedent-js";

type OutputMessage = Output.OutputMessage;
type OutputConsumer = Output.OutputConsumer;

test("Test basic no-op engine proxy" , () => {
    const proxy = createEngineProxy(getEngineBuilder());

    const [words, outputConsumer] = getWordCapturer();
    proxy.setResponseListener(outputConsumer);

    // Start the engine and get some words
    proxy.send(Input.start());
    proxy.send(Input.getNextWords([]));

    expect(words).toHaveLength(3);
    expect(words).toEqual(expect.arrayContaining(["go","look","wait"]));
});

test("Test proxy with word appender", () => {

    let proxy = createEngineProxy(getEngineBuilder());

    const responseFilter = (message : OutputMessage, proxy : Forwarder<unknown,OutputMessage>) => {
        const messageConsumer = new OutputConsumerBuilder()
                                   .withWordsConsumer((command, wordRespsonse) => proxy.respond(Output.words(command, [...wordRespsonse, Output.word("restart", "restart", "option") ])))
                                   .build();
        messageConsumer(message);
    }

    proxy = proxy.insertProxy("test", {responseFilter : responseFilter});

    const [words, outputConsumer] = getWordCapturer();

    proxy.setResponseListener(outputConsumer);

    // Start the engine and get some words
    proxy.send(Input.start());
    proxy.send(Input.getNextWords([]));

    expect(words).toHaveLength(4);
    expect(words).toEqual(expect.arrayContaining(["go","look","wait","restart"]));

});

test("Test commandproxy", () => {
    const proxy = createEngineProxy(getEngineBuilder())
                    .insertProxy("restart", createWordFilter("option", "restart", forwarder => {
                            forwarder.respond(Output.print("Restarting"));
                        }
                    ))

    const [output, outputConsumer] = getWordCapturer();
    proxy.setResponseListener(outputConsumer);

    // Start the engine and get some words
    proxy.send(Input.start());
    proxy.send(Input.getNextWords([]));

    expect(output).toHaveLength(4);
    expect(output).toEqual(expect.arrayContaining(["go","look","wait","restart"]));
    output.length = 0;

    proxy.send(Input.getNextWords(["__option(restart)__"]));
    expect(output).toHaveLength(0);
    output.length = 0;

    proxy.send(Input.execute(["__option(restart)__"]));

    expect(output).toHaveLength(1);
    expect(output).toEqual(expect.arrayContaining(["Restarting"]));
});

test("Test restart using command proxy", () => {
    const data = dedent(`
        ---
        room: northRoom
        desc: The north room
        exits:
          south: southRoom
        tags: ["start"]
        ---
        room: southRoom
        desc: The south room
        exits:
          north: northRoom
        `);

    // Instructions to perform a restart
    const engineInitializer = (forwarder : MessageForwarder) => {
        forwarder.send(Input.reset());
        forwarder.send(Input.load(data));
        forwarder.send(Input.start());
    }

    // Create the restart filter
    const restartFilter = createWordFilter("option", "restart", engineInitializer);

    // Create the engine, and bind the restart proxy
    const engineProxy = createEngineProxy(output => getEngine(output))
                            .insertProxy("restart", restartFilter);

    // Set up and bind the output
    const [output, outputConsumer] = getWordCapturer();
    engineProxy.setResponseListener(outputConsumer);

    // Initialize
    engineInitializer(engineProxy);

    engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The north room"));
    output.length = 0;

    engineProxy.send(Input.getNextWords([]));
    expect(output).toEqual(expect.arrayContaining(["go", "look", "wait", "restart"]));
    output.length = 0;

    engineProxy.send(Input.execute(["go", "south"]))
    engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The south room"));
    output.length = 0;

    engineProxy.send(Input.execute(["__option(restart)__"]));
    engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The north room"));

    engineProxy.send(Input.getNextWords([]));
    expect(output).toEqual(expect.arrayContaining(["go", "look", "wait", "restart"]));
    output.length = 0;
})

function getWordCapturer() : [string[], OutputConsumer] {
    const output : string[] = [];
    const outputConsumer = new OutputConsumerBuilder()
                                    .withWordsConsumer((_command, wordResponse) => output.push(...wordResponse.map(idValue => idValue.value)))
                                    .withMessageConsumer(message => output.push(message))
                                    .build();
    return [output, outputConsumer];
}

function getEngineBuilder() : (output : Consumer<OutputMessage>) => Engine {
    return (output) => {
        const builder = new EngineBuilder().withOutput(output);
        addRooms(builder);
        return builder.build();
    }
}

function addRooms(builder : EngineBuilder) {
    builder.withObj({
        ...NORTH_ROOM,
        desc : "The room is dark and square",
        exits : {
            south : "southRoom"
        },
    })
    builder.withObj({
        ...SOUTH_ROOM,
        name : "The South Room",
        exits : {
            north : "northRoom"
        }
    })
}