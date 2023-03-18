import { OutputConsumerBuilder } from "./main";
import { Execute, GetWords, InputMessage } from "tift-types/src/messages/input";
import * as Output from "./messages/output";
import { OutputMessage, WordType, Word } from "tift-types/src/messages/output"
import { Consumer} from "tift-types/src/util/functions";
import { DuplexProxy, Filters, Forwarder } from "tift-types/src/util/duplexproxy";
import { createDuplexProxy } from "./util/duplexproxy";
import * as _ from "lodash";
import { Engine } from "./engine";
import { StateMachine } from "./util/statemachine";
import { Optional } from "./util/optional";

export type MessageForwarder = Forwarder<InputMessage, OutputMessage>;

export type EngineProxy = DuplexProxy<InputMessage, OutputMessage>;

const ENGINE_PROXY_NAME = "ENGINE";

export class DecoratedForwarder implements MessageForwarder {

    readonly delegate : MessageForwarder;

    constructor(delegate : MessageForwarder) {
        this.delegate = delegate;
    }

    send(request : InputMessage) : void {
        this.delegate.send(request);
    }

    respond(response : OutputMessage) : void {
        this.delegate.respond(response);
    }
    
    print(message : string) {
        this.delegate.respond(Output.print(message));
    }
    
    warn(warning : string) {
        this.delegate.respond(Output.log("warn", warning));
    }
    
    error(error : string) {
        this.delegate.respond(Output.log("warn", error));
    }

    words(command : string[], words : Word[]) {
        this.delegate.respond(Output.words(command, words));
    }

}

export class InputHandler {
    matched = false;

    readonly message : InputMessage;

    constructor(message : InputMessage) {
        this.message = message;
    }

    on(predicate : () => boolean, fn : () => void) {
        if (!this.matched && predicate()) {
            fn();
            this.matched = true;
        }
        return this;
    }

    onCommand(command : string[], fn : () => void) {
        return this.on(() => this.message.type === "Execute" && _.isEqual(this.message.command, command), fn);
    }

    onAnyCommand(fn : (command : string[]) => void) {
        return this.on(() => this.message.type === "Execute", () => fn((this.message as Execute).command));
    }

    onGetWords(fn : (words : string[]) => void) {
        return this.on(() => this.message.type === "GetWords", () => fn((this.message as GetWords).command));
    }

    onAny(fn : (message : InputMessage) => void) {
        return this.on(() => true, () => fn(this.message));
    }
}

export function handleInput(message : InputMessage) : InputHandler {
    return new InputHandler(message);
}

/**
 * Creates a proxied engine, allowing further proxies to be easily attached
 * 
 * @param engineBuilder a function taking an output consumer and creating an engine
 * @returns 
 */
export function createEngineProxy(engineBuilder : (outputConsumer : Consumer<OutputMessage>) => Engine) : EngineProxy {
    const proxy = createDuplexProxy<InputMessage, OutputMessage>(ENGINE_PROXY_NAME, {});
    const engine = engineBuilder(output => proxy.respond(output));
    proxy.setRequestListener(input => engine.send(input));
    return proxy;
}

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

export type MachineInfo = [string, StateMachine<InputMessage,DecoratedForwarder>]
export type MachineMap = {[key:string]:StateMachine<InputMessage,DecoratedForwarder>};


/**
 * Create filter that can execute one or more state machines, depending on which is currently active,
 * and will pass through all requests is none are active
 **/
export function createStateMachineFilter(...machines : MachineInfo[] ) : Filters<InputMessage, OutputMessage> {

    const makeId = (str : string) => "__option(" + str + ")__";

    const machineMap = machines.reduce((accumulator, [name, machine]) => ({ ...accumulator, [makeId(name)] : machine}), {} as MachineMap);

    const commands = machines.map(([name, _machine]) => Output.word("__option(" + name + ")__", name, "option"));

    let activeMachine : Optional<StateMachine<InputMessage,DecoratedForwarder>> = undefined;

    return {
        requestFilter : (message, forwarder) => {
            const decoratedFormatter = new DecoratedForwarder(forwarder);
            let handled = false;
            if (activeMachine?.getStatus() === "RUNNING") {
                activeMachine.send(message, decoratedFormatter);
                handled = true;
            } else if (message.type === "Execute") {
                const command = commands.find(value => value.id === _.last(message.command));
                if (command) {
                    activeMachine = machineMap[command.id];
                    if (activeMachine) {
                        activeMachine.start(decoratedFormatter);
                        handled = true;
                    } else {
                        throw new Error("No state machine found with id: " + command.id);
                    }
                }
            } else if (message.type === "GetWords") {
                const command = commands.find(value => value.id === _.last(message.command));
                if (command) {
                    forwarder.respond(Output.words(message.command, []));
                    handled = true;
                }
            } 
            if (!handled) {
                forwarder.send(message);
            }
        },

        responseFilter : (message, forwarder) => {
            const outputConsumer = new OutputConsumerBuilder()
                                            .withWordsConsumer((command, words) => {
                                                const allWords = [...words, ...commands];
                                                forwarder.respond(Output.words(command, allWords));
                                            })
                                            .withDefaultConsumer(message => forwarder.respond(message))
                                            .build();
            outputConsumer(message);
        }
    }
}

