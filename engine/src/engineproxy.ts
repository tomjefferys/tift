import { OutputConsumerBuilder } from "./main";
import { InputMessage } from "./messages/input";
import * as Output from "./messages/output";
import { Consumer} from "./util/functions";
import { DuplexProxy, Filters, Forwarder } from "./util/duplexproxy";
import * as _ from "lodash";
import { Engine } from "./engine";

type OutputMessage = Output.OutputMessage;

type WordType = Output.WordType;

export type MessageForwarder = Forwarder<InputMessage, OutputMessage>;

export type EngineProxy = DuplexProxy<InputMessage, OutputMessage>;

const ENGINE_PROXY_NAME = "ENGINE";

/**
 * Creates a proxied engine, allowing further proxies to be easily attached
 * 
 * @param engineBuilder a function taking an output consumer and creating an engine
 * @returns 
 */
export function createEngineProxy(engineBuilder : (outputConsumer : Consumer<OutputMessage>) => Engine) : EngineProxy {
    const proxy = new DuplexProxy<InputMessage, OutputMessage>(ENGINE_PROXY_NAME, {});
    const engine = engineBuilder(output => proxy.respond(output));
    proxy.setRequestListener(input => engine.send(input));
    return proxy;
}

/**
 * Creates a filter that can be attatched to a proxy, to specification and interception
 * of a command.  Eg could be used for meta type commands such as "restart" and "save"
 * @param name 
 * @param action 
 * @returns 
 */
//export function createCommandFilter(name : string, action : Consumer<Forwarder<InputMessage, OutputMessage>>) : Filters<InputMessage, OutputMessage> {
//    const commandId = "__command(" + name + ")__";
//    return {
//        requestFilter : (message, forwarder) => {
//            if (message.type === "Execute" && _.isEqual(message.command, [commandId])) {
//                action(forwarder);
//            } else if (message.type === "GetWords" && _.last(message.command) === commandId) {
//                forwarder.respond(Output.words(message.command, []));
//            } else {
//                forwarder.send(message);
//            }
//        },
//
//        responseFilter : (message, forwarder) => {
//            const outputConsumer = new OutputConsumerBuilder()
//                                            .withWordsConsumer((command, words) => {
//                                                const allWords = [...words, Output.word(commandId, name, "option")];
//                                                forwarder.respond(Output.words(command, allWords));
//                                            })
//                                            .withDefaultConsumer(message => forwarder.respond(message))
//                                            .build();
//            outputConsumer(message);
//        }
//    }
//}

//export function createControlFilter(name : string, action : Consumer<void>) : Filters<InputMessage, OutputMessage> {
//    const controlId = "__control(" + name + ")__"
//    return {
//        requestFilter : (message, forwarder) => {
//            if (message.type === "Execute" && _.isEqual(message.command, [name])) {
//                action();
//            } else if (message.type === "GetWords" && _.last(message.command) === controlId) {
//                forwarder.respond(Output.words(message.command, []));
//            } else {
//                forwarder.send(message);
//            }
//        },
//
//        responseFilter : (message, forwarder) => {
//            const outputConsumer = new OutputConsumerBuilder()
//                                            .withWordsConsumer((command, words) => {
//                                                const allWords = [...words, Output.word(controlId, name, "control")];
//                                                forwarder.respond(Output.words(command, allWords));
//                                            })
//                                            .withDefaultConsumer(message => forwarder.respond(message))
//                                            .build();
//            outputConsumer(message);
//        }
//    }
//}

/**
 * Creates a filter that can be attatched to a proxy, to intercept commands before they are passed to the engine
 *  Eg could be used for meta type commands such as "restart" and "save", or control commands suncs as backspace
 * @param type 
 * @param name 
 * @param action 
 * @returns a filter pair
 */
export function createWordFilter(type : WordType, name : string, action : Consumer<Forwarder<InputMessage, OutputMessage>>) : Filters<InputMessage, OutputMessage> {
    const commandId = "__" + type + "(" + name + ")__";
    return {
        requestFilter : (message, forwarder) => {
            if (message.type === "Execute" && _.last(message.command) === commandId) {
                action(forwarder);
            } else if (message.type === "GetWords" && _.last(message.command) === commandId) {
                forwarder.respond(Output.words(message.command, []));
            } else {
                forwarder.send(message);
            }
        },

        responseFilter : (message, forwarder) => {
            const outputConsumer = new OutputConsumerBuilder()
                                            .withWordsConsumer((command, words) => {
                                                const allWords = [...words, Output.word(commandId, name, type)];
                                                forwarder.respond(Output.words(command, allWords));
                                            })
                                            .withDefaultConsumer(message => forwarder.respond(message))
                                            .build();
            outputConsumer(message);
        }
    }
}
