import { MessageType, OutputConsumer } from "../../src/messages/output";
import { bindParams } from "../../src/script/parser"
import { Env, createRootEnv, EnvFn } from "../../src/env"
import { print } from "../../src/messages/output"

export function listOutputConsumer(messages : string[]) : OutputConsumer {
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

export function setUpEnv() : [Env, string[]] {
    const messages : string[] = [];
    const env = createRootEnv({"OUTPUT":listOutputConsumer(messages)}, "writable");
    const write : EnvFn = bindParams(["value"], env => {
        const value = env.get("value");
        return env.get("OUTPUT")(print(value));
    });
    env.set("write", write);
    return [env, messages];
}