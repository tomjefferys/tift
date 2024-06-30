import { Log, LogLevel, OutputConsumer, StatusType } from "tift-types/src/messages/output";
import { PartOfSpeech } from "tift-types/src/messages/word";
import { bindParams } from "../../src/script/parser"
import { createRootEnv } from "../../src/env";
import { Env, EnvFn } from "tift-types/src/env";
import { print } from "../../src/messages/output"
import { History } from "tift-types/src/util/historyproxy";
import { EngineBuilder } from "../../src/builder/enginebuilder";
import * as YAMLParser from "../../src/yamlparser";
import * as fs from "fs"
import { Engine } from "tift-types/src/engine";
import { Input } from "../../src/main";
import { GAME_METADATA } from "./testobjects";
import { Obj } from "tift-types/src/util/objects";

export const STANDARD_VERBS = ["go", "look", "inventory", "wait"];

export type SaveData = { data : History };

export function listOutputConsumer(messages : string[], words : string[], saveData : SaveData, statuses : StatusType[], log : Log[], info : Obj ) : OutputConsumer {
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
            case "Info":
                Object.assign(info, message.properties);
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
    const info = {};
    const consumer = listOutputConsumer(messages, words, saveData, statuses, log, info);
    return [consumer, messages, words, saveData];

}

export function setUpEnv() : [Env, string[], string[], SaveData] {
    const messages : string[] = [];
    const words : string[] = [];
    const saveData = { data : getEmptyHistory() }
    const statuses : StatusType[] = [];
    const log : Log[] = [];
    const info = {};
    const env = createRootEnv({"OUTPUT":listOutputConsumer(messages, words, saveData, statuses, log, info)});
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

interface ExpectedStrings {
    expected? : string[],
    notExpected? : string[],
    errors? : string[]
}

export type ExecuteAndTestFn = (command : string[], expectedStrings : ExpectedStrings) => void;

export type EngineRef = Engine & { ref : Engine | null };

export function createEngineRef() : EngineRef {
    const engine : EngineRef =  {
        ref : null,
        send : message => {
            if (!engine.ref) {
                throw new Error("Engine reference has not been set yet");
            }
            engine.ref.send(message);
            return Promise.resolve();
        } 
    }
    return engine;
}

export function createExecuteAndTest(engine : EngineRef, messages : string[], log : Log[]) : ExecuteAndTestFn {
    return (command, expectedStrings) => {
        engine.send(Input.execute(command));

        if (expectedStrings.errors) {
            const logMessages = [...findLogMessages("error", log),
                                ...findLogMessages("warn", log)].join("\n");
            expectedStrings.errors.forEach(str => {
                expect(logMessages).toContain(str);
            });
        } else {
            const errors = findLogMessages("error", log);
            expect(errors).toHaveLength(0);

            const warnings = findLogMessages("warn", log);
            expect(warnings).toHaveLength(0);
        }

        log.length = 0;

        const joined = messages.join("\n").replace(/\s+/g, ' ');
        expectedStrings.expected?.forEach(str => {
            expect(joined).toContain(str);
        })
        expectedStrings.notExpected?.forEach(str => {
            expect(joined).not.toContain(str);
        })
        messages.length = 0;
    }
}

export type GetWordIdsFn = (partial : string[]) => string[];

export function createGetWordIds(engine : EngineRef, wordsResponse : string[]) : GetWordIdsFn {
    return (partial) => {
        const commandWords = partial.map((word, index) => (
                { id : word, 
                  value : word, 
                  type : "word", 
                  partOfSpeech : "verb", // FIXME won't always be verbs
                  position : index + 1} as PartOfSpeech));
        engine.send(Input.getNextWords(commandWords));
        const words = [...wordsResponse];
        wordsResponse.length = 0;
        return words;
    }
}

export type ExpectWordsFn = (command : string[], 
                             expectedNextWords : string[],
                             exactMatch? : boolean,
                             notExpected? : string[]) => void;

export function createExpectWords(getWordIds : GetWordIdsFn) : ExpectWordsFn {
    return (command, expectedNextWords, exactMatch = true, notExpected = []) => {
        const words = getWordIds(command);

        if (exactMatch) {
            expect(words).toHaveLength(expectedNextWords.length);
            expect(words).toEqual(expect.arrayContaining(expectedNextWords));
        } else {
            expectedNextWords.forEach(expected => expect(words).toContain(expected));
        }
        if (notExpected.length > 0) {
            expect(words).not.toEqual(expect.arrayContaining(notExpected));
        }
    }
}

export type ExpectStatusFn = (expected : Partial<StatusType>) => void;

export function createExpectStatus(engine: EngineRef, statuses : StatusType[]) : ExpectStatusFn {
    return (expected) => {
        engine.send(Input.getStatus());
        const actual = statuses.at(-1);
        expect(actual).not.toBeUndefined();
        if (actual) {
            for(const [name, value] of Object.entries(expected)) {
                expect(actual[name as keyof StatusType]).toBe(value);
            }
        }
        statuses.length = 0;
    }
}

export interface TestEnvironment {
    messages : string[],
    wordsResponse : string[],
    statuses : StatusType[],
    saveData : SaveData,
    log : Log[],
    builder : EngineBuilder,
    engine : EngineRef,
    info : Obj,
    executeAndTest : ExecuteAndTestFn,
    getWordsIds : GetWordIdsFn,
    expectWords : ExpectWordsFn,
    expectStatus : ExpectStatusFn
}



export function createEngineTestEnvironment() : TestEnvironment {
    const messages : string[] = [];
    const wordsResponse : string[] = [];
    const statuses : StatusType[] = [];
    const saveData = { data : getEmptyHistory() };
    const log : Log[] = [];
    const info = {};
    const builder = new EngineBuilder().withOutput(listOutputConsumer(messages, wordsResponse, saveData, statuses, log, info));
    const engine = createEngineRef();
    builder.withObj(GAME_METADATA);
    loadDefaults(builder);
    const executeAndTest = createExecuteAndTest(engine, messages, log);
    const getWordsIds = createGetWordIds(engine, wordsResponse);
    const expectWords = createExpectWords(getWordsIds);
    const expectStatus = createExpectStatus(engine, statuses);
    return {
        messages,
        wordsResponse,
        statuses,
        saveData,
        log,
        builder,
        engine,
        info,
        executeAndTest,
        getWordsIds,
        expectWords,
        expectStatus
    }

}