import { OutputConsumerBuilder } from "./main";
import { InputMessage } from "./messages/input";
import * as Output from "./messages/output";
import { mkIdValue } from "./shared";
import { Consumer} from "./util/functions";
import { DuplexProxy, Filters, Forwarder } from "./util/duplexproxy";
import * as _ from "lodash";
import { Engine } from "./engine";

type OutputMessage = Output.OutputMessage;

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
export function createCommandFilter(name : string, action : Consumer<Forwarder<InputMessage, OutputMessage>>) : Filters<InputMessage, OutputMessage> {
    return {
        requestFilter : (message, forwarder) => {
            if (message.type === "Execute" && _.isEqual(message.command, [name])) {
                action(forwarder);
            } else {
                forwarder.send(message);
            }
        },

        responseFilter : (message, forwarder) => {
            const outputConsumer = new OutputConsumerBuilder()
                                            .withWordsConsumer((command, words) => forwarder.respond(Output.words(command, [...words, mkIdValue(name, name)])))
                                            .withDefaultConsumer(message => forwarder.respond(message))
                                            .build();
            outputConsumer(message);
        }
    }
}
