import { Log, LogLevel, OutputConsumer, StatusType } from "tift-types/src/messages/output";
import { bindParams } from "../../src/script/parser"
import { createRootEnv } from "../../src/env";
import { Env, EnvFn } from "tift-types/src/env";
import { print } from "../../src/messages/output"
import { History } from "tift-types/src/util/historyproxy";
import { EngineBuilder } from "../../src/builder/enginebuilder";
import * as YAMLParser from "../../src/yamlparser";
import * as fs from "fs"

export const STANDARD_VERBS = ["go", "look", "inventory", "wait"];

export type SaveData = { data : History };

export function listOutputConsumer(messages : string[], words : string[], saveData : SaveData, statuses : StatusType[], log : Log[] ) : OutputConsumer {
    return message => {
        switch(message.type) {
            case "Print":
                messages.push(message.value);
                break;
            case "Words": 
                message.words.forEach(word => words.push(word.id));
                break;
            case "SaveState":
                saveData.data = message.state;
                break;
            case "Log":
                log.push(message);
                break;
            case "Status":
                statuses.push(message.status);
                break;
            default:
                throw new Error("Can't handle type " + message.type);
        }
    }
}

export function getEmptyHistory() : History {
    return { baseHistory : [], undoStack : [], redoStack : []};
}

export function defaultOutputConsumer() : [OutputConsumer, string[], string[], SaveData] {
    const messages : string[] = [];
    const words : string[] = [];
    const statuses : StatusType[] = [];
    const saveData = { data : getEmptyHistory() }
    const log : Log[] = [];
    const consumer = listOutputConsumer(messages, words, saveData, statuses, log);
    return [consumer, messages, words, saveData];

}

export function setUpEnv() : [Env, string[], string[], SaveData] {
    const messages : string[] = [];
    const words : string[] = [];
    const saveData = { data : getEmptyHistory() }
    const statuses : StatusType[] = [];
    const log : Log[] = [];
    const env = createRootEnv({"OUTPUT":listOutputConsumer(messages, words, saveData, statuses, log)});
    const write : EnvFn = bindParams(["value"], env => {
        const value = env.get("value");
        return env.get("OUTPUT")(print(value));
    });
    env.set("write", write);
    return [env, messages, words, saveData];
}

export const findLogMessages : (level : LogLevel, messages : Log[]) => string[] =
    (level,messages) => messages.filter(message => message.level === level).map(message => message.message)

export function loadDefaultsYAML() : string {
    return fs.readFileSync("test/resources/properties.yaml", "utf8");
}

export function loadStdLib() : string {
    return fs.readFileSync("test/resources/stdlib.yaml", "utf8");
}

export function loadDefaults(builder : EngineBuilder) {
    const defaults = loadDefaultsYAML();
    YAMLParser.getObjs(defaults)
              .forEach(obj => builder.withObj(obj));

    const stdlib = loadStdLib();
    YAMLParser.getObjs(stdlib)
              .forEach(obj => builder.withObj(obj));
}