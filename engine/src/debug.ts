// Various debugging commands and utilities

import { Word } from "tift-types/src/messages/word";
import { Env } from "tift-types/src/env";
import { LogLevel, OutputConsumer } from "tift-types/src/messages/output";
import { Behaviour } from "./game/behaviour";
import * as MultiDict from "./util/multidict";
import { Obj } from "./util/objects";
import * as _ from "lodash";
import * as Locations from "./game/locations";
import * as Player from "./game/player";

const COMMANDS = {
    INSPECT : "debug.inspect",
    LIST : "debug.list",
    GET : "debug.get",
    DROP : "debug.drop",
    TELEPORT : "debug.teleport",
} as const;

// Simple flag to disable debug commands during tests
const ENABLE_DEBUG = process.env.NODE_ENV !== 'test';

const HIDDEN_FIELDS = ["__sourceMap__", "__kind__"];

const CONTEXT = "context";
const CONTEXT_ITEM = "context-item";

const LIST_TYPES : Record<string, string> = {
    "room" : "rooms",
    "item" : "items",
    "object" : "objects",
    "verb" : "verbs",
    "special" : "specials",
    [CONTEXT] : "contexts"  
}

const INSPECT_TYPES = ["room", "item", "object", "verb", "special", CONTEXT, CONTEXT_ITEM];
 
type GetWordHandler = (env : Env, behaviour : Behaviour, words : Word[]) => Word[];
type ExecuteHandler = (env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer, command : string[]) => void;

const DEBUG_COMMANDS : Word[] = [
    debugCommand(COMMANDS.LIST, "list"),
    debugCommand(COMMANDS.INSPECT, "inspect"),
    debugCommand(COMMANDS.GET, "get"),
    debugCommand(COMMANDS.DROP, "drop"),
    debugCommand(COMMANDS.TELEPORT, "teleport")
];
 
const GET_WORD_HANDLERS : Record<string, GetWordHandler> = {
    [COMMANDS.INSPECT] : getInspectOptions,
    [COMMANDS.LIST] : getListOptions,
    [COMMANDS.GET] : getGetOptions,
    [COMMANDS.DROP] : getDropOptions,
    [COMMANDS.TELEPORT] : getTeleportOptions
}

const EXECUTE_HANDLERS : Record<string, ExecuteHandler> = {
    [COMMANDS.INSPECT] : executeInspect,
    [COMMANDS.LIST] : executeList,
    [COMMANDS.GET] : executeGet,
    [COMMANDS.DROP] : executeDrop,
    [COMMANDS.TELEPORT] : executeTeleport
};

// TODO add trace debug command

// Get possible debug commands based on input words
export function getDebugCommands(env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer, words : Word[]) : Word[] {
    if (!ENABLE_DEBUG) {
        return [];
    }

    // Remove any wildcards, not part of debug commands, and complicates logic to leave them in.
    const debugWords = words.filter(word => word.id !== "?");

    try {
        if (debugWords.length == 0) {
            return DEBUG_COMMANDS;
        } else if (debugWords[0].id.startsWith("debug.") ) {
            const handler = GET_WORD_HANDLERS[debugWords[0].id];
            if (!handler) {
                throw new Error(`No debug word handler for ${debugWords[0].id}`);
            }
            return handler(env, behaviour, debugWords);
        } else { // Not a debug command
            return [];
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(outputConsumer, `Error getting debug commands: ${errorMessage}`, "error");
        return [];
    }
}

// Execute a debug command, returning true if it was a debug command
export function executeDebugCommand(env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer, command : string[]) : boolean {
    const isDebug = command.length > 0 && command[0].startsWith("debug.");
    if (isDebug) {
        try {
            const handler = EXECUTE_HANDLERS[command[0]];
            if (!handler) {
                throw new Error(`No debug command handler for ${command[0]}`);
            }
            handler(env, behaviour, outputConsumer, command);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log(outputConsumer, `Error executing debug command: ${errorMessage}`, "error");
        }
    }
    return isDebug;
}

function getInspectOptions(env : Env, behaviour : Behaviour, command : Word[]) : Word[] {
    if (command.length === 1 ) {
        return getInspectTypes();
    } else if (command.length === 2) {
        const type = command[1].id;
        return getInspectTargets(env, behaviour, type);
    } else if (command.length === 3 && command[1].id === CONTEXT_ITEM) {
        const ctxId = command[2].id;
        return getInspectContextItems(env, behaviour, ctxId);
    }
    return [];
}

function getInspectTypes() : Word[] {
    return INSPECT_TYPES.map(type => debugCommand(type, type));
}

function getInspectTargets(env : Env, behaviour : Behaviour, type : string) : Word[] {
    if (type === CONTEXT || type === CONTEXT_ITEM) {
        const contexts = getContexts(env, behaviour);
        return contexts.map(ctxId => debugCommand(ctxId, ctxId));
    } else {
        const allObjs = env.findObjs(obj => obj["type"] === type, [["entities"], ["verbs"]]);
        return allObjs.map(obj => debugCommand(obj.id, obj.id));
    }
}

function getInspectContextItems(env : Env, behaviour : Behaviour, contextId : string) : Word[] {
        const contexts = behaviour.getContext(env).entities;
        if (MultiDict.keys(contexts).includes(contextId)) {
            const items = MultiDict.get(contexts, contextId);
            return items.map(item => debugCommand(item.id, item.id));
        }
        throw new Error(`No context found with id: ${contextId}`);
}

function executeInspect(env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer, command : string[]) {
    if (command.length < 3) {
        throw new Error("inspect command requires type and id");
    }
    const type = command[1];
    const id = command[2];
    if (type === CONTEXT) {
        inspectContext(env, behaviour, outputConsumer, id);
    } else if (type === CONTEXT_ITEM) {
        inspectContextItem(env, behaviour, outputConsumer, id, command[3]);
    } else {
        inspectObject(env, behaviour, outputConsumer, type, id);
    }
}

function inspectObject(env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer, type : string, id : string) {
    const objs = env.findObjs(obj => obj["type"] === type && obj.id === id, [["entities"], ["verbs"]]);
    if (objs.length === 0) {
        throw Error(`No object found with type: ${type} and id: ${id}`);
    } else {
        const obj = objs[0];
        const entries = Object.entries(obj)
                              .filter(([key, value]) => includeEntry(key, value));
        for (const [key, value] of entries) {
            log(outputConsumer, `${key}: ${JSON.stringify(value, null, 2)}`);
        }
    }
}

function inspectContext(env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer, contextId : string) {
    const contexts = behaviour.getContext(env).entities;

    if (!MultiDict.keys(contexts).includes(contextId)) {
        throw new Error(`No context found with id: ${contextId}`);
    }
    MultiDict.get(contexts, contextId).forEach(entity => {
        log(outputConsumer, getEntityString(entity));
    });
}

function inspectContextItem(env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer, contextId : string, itemId : string) {
    const contexts = behaviour.getContext(env).entities;

    if (!MultiDict.keys(contexts).includes(contextId)) {
        throw new Error(`No context found with id: ${contextId}`);
    }
    const items = MultiDict.get(contexts, contextId);
    const item = items.find(i => i.id === itemId);
    if (!item) {
        throw new Error(`No item found in context ${contextId} with id: ${itemId}`);
    }
    const entries = Object.entries(item)
                          .filter(([key, value]) => includeEntry(key, value));
    for (const [key, value] of entries) {
        log(outputConsumer, `${key}: ${JSON.stringify(value, null, 2)}`);
    }
}

function getListOptions(_env : Env, _behaviour : Behaviour, command : Word[]) : Word[] {
    const words : Word[]= [];
    if (command.length === 1) {
        words.push(...Object.entries(LIST_TYPES).map(([key,value]) => debugCommand(key, value)));
    }
    return words;
}

function executeList(env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer, command : string[]) {
    if (command.length < 2) {
        throw new Error("list command requires type");
    }
    const type = command[1];
    if (type === "context") {
        listContexts(env, behaviour, outputConsumer);
    } else {
        listEntityTypes(env, behaviour, outputConsumer, type);
    }
}

function listEntityTypes(env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer, type : string) {
    const objs = env.findObjs(obj => obj["type"] === type, [["entities"], ["verbs"]]);
    objs.forEach(obj => {
        const output = getEntityString(obj);
        log(outputConsumer, output)
    });

}

function listContexts(env : Env, behaviour : Behaviour, outputConsumer : OutputConsumer) {
    const contexts = getContexts(env, behaviour);
    contexts.forEach(ctxId => {
        log(outputConsumer, `${ctxId}`);
    });
}

function getGetOptions(env : Env, _behaviour : Behaviour, command : Word[]) : Word[] {
    const options = [];
    if (command.length === 1 ) {
        options.push(...getItems(env));
    }
    return options;
}

function executeGet(env : Env, _behaviour : Behaviour, outputConsumer : OutputConsumer, command : string[]) {
    if (command.length < 2) {
        throw new Error("Get command requires item");
    }

    const itemId = command[1];
    const items = env.findObjs(obj => obj["type"] === "item" && obj.id === itemId, [["entities"]]);
    if (items.length === 0) {
        throw new Error(`No item found with id: ${itemId}`);
    }

    const item = items[0];
    Locations.setLocation(env, item, Player.INVENTORY);
    log(outputConsumer, `Item ${itemId} added to player inventory.`);
}

function getDropOptions(env : Env, _behaviour : Behaviour, command : Word[]) : Word[] {
    const options = [];
    if (command.length === 1 ) {
        options.push(...getItems(env));
    }
    return options;
}

function executeDrop(env : Env, _behaviour : Behaviour, outputConsumer : OutputConsumer, command : string[]) {
    if (command.length < 2) {
        throw new Error("Drop command requires item");
    }

    const itemId = command[1];
    const items = env.findObjs(obj => obj["type"] === "item" && obj.id === itemId, [["entities"]]);
    if (items.length === 0) {
        throw new Error(`No item found with id: ${itemId}`);
    }

    const item = items[0];
    Locations.setLocation(env, item, Player.getLocation(env));
    log(outputConsumer, `Item ${itemId} dropped in current location.`);
}

function getTeleportOptions(env : Env, _behaviour : Behaviour, command : Word[]) : Word[] {
    const options = [];
    if (command.length === 1 ) {
        const locations = env.findObjs(obj => obj["type"] === "room", [["entities"]]);
        const words =  locations.map(loc => debugCommand(loc.id, loc.id));
        options.push(...words);
    }
    return options;
}

function executeTeleport(env : Env, _behaviour : Behaviour, outputConsumer : OutputConsumer, command : string[]) {
    if (command.length < 2) {
        throw new Error("Teleport command requires location");
    }
    
    const locationId = command[1];
    const locations = env.findObjs(obj => obj["type"] === "room" && obj.id === locationId, [["entities"]]); 
    if (locations.length === 0) {
        throw new Error(`No location found with id: ${locationId}`);
    }
    
    const location = locations[0];
    const player = Player.getPlayer(env);
    Locations.setLocation(env, player, location.id);
    log(outputConsumer, `Player teleported to location ${locationId}.`);
}

function getItems(env : Env) : Word[] {
    const items = env.findObjs(obj => obj["type"] === "item", [["entities"]]);
    const words = items.map(item => debugCommand(item.id, item.id));
    return words;
}

function getContexts(env : Env, behaviour : Behaviour) : string[] {
    const context = behaviour.getContext(env);
    return MultiDict.keys(context.entities);
}

function includeEntry(key : string, value : unknown) : boolean {
    return  !HIDDEN_FIELDS.includes(key) &&
            (!_.isArray(value) || value.length > 0) &&
            (!_.isObject(value) || Object.keys(value).length > 0);
}

function getEntityString(entity : Obj) : string {
    return `${entity.id}` + (entity.name ? ` (${entity.name})` : "");
}

function log(outputConsumer : OutputConsumer, message : string, level : LogLevel = "debug") {
    outputConsumer({
        type: "Log",
        level,
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