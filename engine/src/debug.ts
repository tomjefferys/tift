// Various debugging commands and utilities

import { Word } from "tift-types/src/messages/word";
import { Env } from "tift-types/src/env";
import { OutputConsumer } from "tift-types/src/messages/output";
import _ from "lodash";

// Simple flag to disable debug commands during tests
const ENABLE_DEBUG = process.env.NODE_ENV !== 'test';

const HIDDEN_FIELDS = ["__sourceMap__", "__kind__"];

const DEBUG_COMMANDS : Word[] = [
    debugCommand("debug.showState", "Show Engine State"),
    debugCommand("debug.listEntities", "List All Entities"),
    debugCommand("debug.listVerbs", "List All Verbs"),
    debugCommand("debug.inspect", "Inspect"),
];

// Other commands: teleport, get, trace, items in context

export function getDebugCommands(env : Env, words : Word[]) : Word[] {
    if (!ENABLE_DEBUG) {
        return [];
    }
    if (words.length == 1 && words[0].id === "?") {
        return DEBUG_COMMANDS;
    }
    if (words.length === 2 && words[0].id === "debug.inspect" && words[1].id === "?") {
        const allObjs = env.findObjs(_ => true, [["entities"], ["verbs"]]);
        return allObjs.map(obj => debugCommand(obj.id, obj.id));
    }        
    return [];
}

export function executeDebugCommand(env : Env, outputConsumer : OutputConsumer,command : string[]) : boolean {
    const isDebug = command.length > 0 && command[0].startsWith("debug.");
    // Placeholder for actual debug command execution logic
    if (isDebug) {
        switch (command[0]) {
            case "debug.listEntities":
                listEntities(env, outputConsumer);
                break;
            case "debug.listVerbs":
                listVerbs(env, outputConsumer);
                break;
            case "debug.inspect":
                if (command.length > 1) {
                    inspect(env, outputConsumer, command[1]);
                } else {
                    log(outputConsumer, "Usage: debug.inspect <entityId>");
                }
                break;
            default:
                log(outputConsumer, `Unknown debug command: ${command.join(" ")}`);
        }   
    }
    return isDebug;
}

function listEntities(env : Env, outputConsumer : OutputConsumer) {
    env.findObjs(_ => true, [["entities"]]).forEach(entity => {
        log(outputConsumer, `- ${entity.id} (${entity.name})`);
    });
}

function listVerbs(env : Env, outputConsumer : OutputConsumer) {
    env.findObjs(_ => true, [["verbs"]]).forEach(verb => {
        log(outputConsumer, `- ${verb.id} (${verb.name})`);
    });
}

function inspect(env : Env, outputConsumer : OutputConsumer, objId : string) {
    const objs = env.findObjs(obj => obj.id === objId);
    if (objs.length === 0) {
        log(outputConsumer, `No object found with id: ${objId}`);
    } else {
        const obj = objs[0];
        const entries = Object.entries(obj)
                              .filter(([key, value]) => includeEntry(key, value));
        for (const [key, value] of entries) {
            log(outputConsumer, `${key}: ${JSON.stringify(value, null, 2)}`);
        }
    }
}

function includeEntry(key : string, value : unknown) : boolean {
    let include = !HIDDEN_FIELDS.includes(key);
    include &&= !_.isArray(value) || value.length > 0;
    include &&= !_.isObject(value) || Object.keys(value).length > 0;
    return include;
}

function log(outputConsumer : OutputConsumer, message : string) {
    outputConsumer({
        type: "Log",
        level: "debug",
        message
    });
}

function debugCommand(id : string, value : string) : Word {
    return {
        id,
        value,
        type : "word",
        partOfSpeech : "verb",
        position : 0,
        tags : ["debug"] };
}