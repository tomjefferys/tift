import { OutputConsumer } from "../../src/messages/output";
import { bindParams } from "../../src/script/parser"
import { Env, createRootEnv, EnvFn } from "../../src/env"
import { print } from "../../src/messages/output"

export function listOutputConsumer(messages : string[], words : string[]) : OutputConsumer {
    return message => {
        switch(message.type) {
            case "Print":
                messages.push(message.value);
                break;
            case "Words": 
                message.words.forEach(word => words.push(word.id));
                break;
            default:
                throw new Error("Can't handle type " + message.type);
        }
    }
}

export function setUpEnv() : [Env, string[], string[]] {
    const messages : string[] = [];
    const words : string[] = [];
    const env = createRootEnv({"OUTPUT":listOutputConsumer(messages, words)}, "writable");
    const write : EnvFn = bindParams(["value"], env => {
        const value = env.get("value");
        return env.get("OUTPUT")(print(value));
    });
    env.set("write", write);
    return [env, messages, words];
}