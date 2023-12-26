import { EngineBuilder } from "../src/builder/enginebuilder";
import { getEngine, Input, OutputConsumerBuilder } from "../src/main";
import { Consumer } from "tift-types/src/util/functions";
import { Forwarder } from "tift-types/src/util/duplexproxy";
import { GAME_METADATA, NORTH_ROOM, SOUTH_ROOM } from "./testutils/testobjects";
import * as Output from "../src/messages/output";
import { OutputMessage, OutputConsumer } from "tift-types/src/messages/output";
import { createWordFilter, createEngineProxy, createStateMachineFilter, handleInput } from "../src/engineproxy";
import { MessageForwarder, DecoratedForwarder } from "tift-types/src/engineproxy";
import { Engine } from "tift-types/src/engine";
import _ from "lodash";
import dedent from "dedent-js";
import { buildStateMachine, TERMINATE } from "../src/util/statemachine";
import { InputMessage } from "tift-types/src/messages/input";
import { loadDefaultsYAML, STANDARD_VERBS } from "./testutils/testutils";

test("Test basic no-op engine proxy" , () => {
    const proxy = createEngineProxy(getEngineBuilder());

    const [words, outputConsumer] = getWordCapturer();
    proxy.setResponseListener(outputConsumer);

    // Start the engine and get some words
    proxy.send(Input.start());
    proxy.send(Input.getNextWords([]));

    expect(words).toHaveLength(STANDARD_VERBS.length);
    expect(words).toEqual(expect.arrayContaining([...STANDARD_VERBS]));
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

    expect(words).toHaveLength(STANDARD_VERBS.length + 1);
    expect(words).toEqual(expect.arrayContaining([...STANDARD_VERBS, "restart"]));

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

    expect(output).toHaveLength(STANDARD_VERBS.length + 1);
    expect(output).toEqual(expect.arrayContaining([...STANDARD_VERBS, "restart"]));
    output.length = 0;

    proxy.send(Input.getNextWords(["__option(restart)__"]));
    expect(output).toHaveLength(0);
    output.length = 0;

    proxy.send(Input.execute(["__option(restart)__"]));

    expect(output).toHaveLength(1);
    expect(output).toEqual(expect.arrayContaining(["Restarting"]));
});

test("Test restart using command proxy", async () => {
    const data = dedent(`
        ---
        game: The Game
        options:
          - useDefaultVerbs
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
        forwarder.send(Input.load(loadDefaultsYAML()))
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

    await engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The north room"));
    output.length = 0;

    await engineProxy.send(Input.getNextWords([]));
    expect(output).toEqual(expect.arrayContaining([...STANDARD_VERBS, "restart"]));
    output.length = 0;

    await engineProxy.send(Input.execute(["go", "south"]))
    await engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The south room"));
    output.length = 0;

    await engineProxy.send(Input.execute(["__option(restart)__"]));
    await engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The north room"));

    await engineProxy.send(Input.getNextWords([]));
    expect(output).toEqual(expect.arrayContaining([...STANDARD_VERBS, "restart"]));
    output.length = 0;
})

test("test restart using state machine proxy", async () => {
    const data = dedent(`
        ---
        game: The Game
        options:
          - useDefaultVerbs
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
        forwarder.send(Input.load(loadDefaultsYAML()))
        forwarder.send(Input.load(data));
        forwarder.send(Input.start());
    }
    
    const restartOptions = [Output.word("restart", "restart", "option"), Output.word("cancel", "cancel", "option")];

    // Build the state machine
    const machine = buildStateMachine<InputMessage, DecoratedForwarder>("prompt", ["prompt", {
        onEnter : forwarder => {
            forwarder.print("Are you sure?");
            forwarder.words([], restartOptions);
        },
        onAction : async (input, forwarder) => {
            let finished = false;
            const handler = handleInput(input);
            await handler.onCommand(["restart"], async () => {
                    forwarder.print("restarting");
                    engineInitializer(forwarder);
                    finished = true;
                });
            await handler.onCommand(["cancel"], async () => {
                    forwarder.print("cancel");
                    finished = true;
                });
            await handler.onAnyCommand(async command => {
                    forwarder.warn("Unexpected command: " + command.join(" "));
                });
            await handler.onGetWords(async () => {
                    forwarder.respond(Output.words([], restartOptions));
                });
            await handler.onAny(async message => {
                    forwarder.warn("Unexpected message: " + JSON.stringify(message));
                });
            return finished ? TERMINATE : undefined;
        }
    }]);

    // Create the restart filter
    const restartFilter = createStateMachineFilter(["restart", machine]);

    // Create the engine, and bind the restart proxy
    const engineProxy = createEngineProxy(output => getEngine(output))
                            .insertProxy("restart", restartFilter);

    // Set up and bind the output
    const [output, outputConsumer] = getWordCapturer();
    engineProxy.setResponseListener(outputConsumer);

    // Initialize
    engineInitializer(engineProxy);

    await engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The north room"));
    output.length = 0;

    await engineProxy.send(Input.getNextWords([]));
    expect(output).toEqual(expect.arrayContaining([...STANDARD_VERBS, "restart"]));
    output.length = 0;

    await engineProxy.send(Input.execute(["go", "south"]))
    await engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The south room"));
    output.length = 0;

    // Trigger restart
    await engineProxy.send(Input.execute(["__option(restart)__"]));
    expect(output).toEqual(["Are you sure?", "restart", "cancel"])
    output.length = 0;

    // Cancel
    await engineProxy.send(Input.execute(["cancel"]));
    expect(output).toEqual(["cancel"]);
    output.length = 0;

    // Still in south room
    await engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The south room"));
    output.length = 0;

    // Trigger restart
    await engineProxy.send(Input.execute(["__option(restart)__"]));
    expect(output).toEqual(["Are you sure?", "restart", "cancel"])
    output.length = 0;

    // Confirm
    await engineProxy.send(Input.execute(["restart"]));
    expect(output).toEqual(["restarting"]);
    output.length = 0;

    // Back in north room
    await engineProxy.send(Input.execute(["look"]));
    expect(output[0]).toEqual(expect.stringContaining("The north room"));
    output.length = 0;

    await engineProxy.send(Input.getNextWords([]));
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
        const builder = new EngineBuilder().withOutput(output).withObj(GAME_METADATA);
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