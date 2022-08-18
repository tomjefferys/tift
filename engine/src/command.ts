import _ from "lodash";
import { Entity, getName } from "./entity";
import { IdValue, mkIdValue } from "./shared";
import { Verb } from "./verb"


// Part of Speech
type Part =  Start | MainVerb | DirectObject | IndirectObject | Preposition | Modifier | Preposition

export type PoSType = "start" | "verb" | "directObject" | "preposition" | "indirectObject" | "modifier";

type PoSObjectType<T> =
        T extends "start" ? Start :
        T extends "verb" ? MainVerb :
        T extends "directObject" ? DirectObject : 
        T extends "preposition" ? Preposition : 
        T extends "indirectObject" ? IndirectObject :
        T extends "modifier" ? Modifier :
        never;

export type Command = SentenceNode;

export interface SentenceNode {
    part : Part,
    previous? : SentenceNode,
    
    getPoS<T extends PoSType>(posType : T) : PoSObjectType<T> | undefined,
    getVerb(verbId : string) : MainVerb | undefined, 
    getDirectObject(entityId : string) : DirectObject | undefined,
    getPreposition(prepos : string) : Preposition | undefined,
    getModifier(modtype : string, modValue : string) : Modifier | undefined,
    getIndirectObject(entityId : string) : IndirectObject | undefined,

    find(predicate : (part : Part) => boolean) : Part | undefined,

    findAll(predicate : (part : Part) => boolean) : Part[],

    getModifiers() : Modifier[];

    size() : number;

    getWords() : IdValue<string>[];

    toString() : string;

}

export interface Start {
    type : "start"
}

export interface MainVerb {
    type : "verb"
    verb : Verb
}

export interface DirectObject {
    type : "directObject",
    entity : Entity
}

export interface Preposition {
    type : "preposition",
    value : string,
}

export interface IndirectObject {
    type : "indirectObject",
    entity : Entity
}

export interface Modifier {
    type : "modifier"
    modType : string,
    value : string
}

interface Verbable {
    verb : (verb : Verb) => SentenceNode & Directable & Prepositionable & Modifiable
}

interface Directable {
    object : (entity : Entity) => SentenceNode & Prepositionable & Modifiable
}

interface Indirectable {
    object : (entity : Entity) => SentenceNode & Prepositionable & Modifiable;
}

interface Prepositionable {
    preposition : (prepos : string) => SentenceNode & Indirectable;
}

interface Modifiable {
    modifier : (modType : string, modValue : string) => SentenceNode & Prepositionable & Modifiable
}

function getWords(node : SentenceNode) : IdValue<string>[] {
    let word = undefined;
    const part = node.part;
    switch(part.type) {
        case "verb":
            word = mkIdValue(part.verb.id, part.verb.getName());
            break;
        case "directObject":
        case "indirectObject":
            word = mkIdValue(part.entity.id, getName(part.entity));
            break;
        case "preposition":
        case "modifier":
            word = mkIdValue(part.value, part.value);
            break;
        default:
            throw new Error("Invalid PoS type" + part.type);
    }

    const words = (node.previous && node.previous.part.type !== "start")? getWords(node.previous) : [];
    words.push(word);
    return words;
}

export function start() : SentenceNode & Verbable {
    return verbable(makeNode({type : "start"}));
}

export function verb(verb : Verb) : SentenceNode & Directable & Prepositionable & Modifiable {
    const mainVerb : MainVerb = {
        type : "verb",
        verb : verb
    }
    return directable(modifiable(prepositionable(makeNode(mainVerb))));
}

export function castVerbable<T extends SentenceNode>(node : T) : T & Verbable {
    if (!("verb" in node && node.part.type === "start") ) {
        throw new Error(node + " can't accept a verb, verbs must be at the start of a commmand");
    }
    return node as T & Verbable;
}

export function castDirectable<T extends SentenceNode>(node : T) : T & Directable {
    if (!("object" in node && node.part.type === "verb") ) {
        throw new Error(node + " can't accept a direct object, it must be a verb");
    }
    return node as T & Directable;
}

export function castIndirectable<T extends SentenceNode>(node : T) : T & Directable {
    if (!("object" in node && node.part.type === "preposition") ) {
        throw new Error(node + " can't accept a direct inobject, it must be a preposition");
    }
    return node as T & Indirectable;
}

export function castPreopositional<T extends SentenceNode>(node : T) : T & Prepositionable {
    if (!("preposition" in node)) {
        throw new Error(node + " can't accept a proposition");
    }
    return node as T & Prepositionable;
}

export function castModifiable<T extends SentenceNode>(node : T) : T & Modifiable {
    if (!("modifier" in node)) {
        throw new Error(node + " can't accept a modifier");
    }
    return node as T & Modifiable;
}

function verbable<T extends SentenceNode>(node : T) : T & Verbable {
    const newNode = {
        ...node,
        verb : (verb : Verb) => directable(modifiable(prepositionable(makeNode({ type : "verb", verb : verb}, node))))
    }
    return newNode;
}

function directable<T extends SentenceNode>(node : T) : T & Directable {
    const newNode = {
        ...node,
        object : (entity : Entity) => prepositionable(modifiable(makeNode({ type : "directObject", entity : entity}, node)))
    }
    return newNode;
}

function indirectable<T extends SentenceNode>(node : T) : T & Indirectable {
    const newNode = {
        ...node,
        object : (entity : Entity) => prepositionable(modifiable(makeNode({ type : "indirectObject", entity : entity}, node)))
    }
    return newNode;
}


function prepositionable<T extends SentenceNode>(node : T) : T & Prepositionable {
    const newNode = {
        ...node,
        preposition : (prepos : string) => indirectable(makeNode({ type : "preposition", value : prepos }, node))
    }
    return newNode
}

function modifiable<T extends SentenceNode>(node : T) : T & Modifiable {
    const newNode = {
        ...node,
        modifier : (modType : string, modValue : string) => prepositionable(modifiable(makeNode({ type : "modifier", modType : modType, value : modValue }, node)))
    }
    return newNode;
}

function makeNode(part : Part, prev? : SentenceNode) : SentenceNode {
    const node : SentenceNode = {
        part : part, 
        previous : prev,

        getPoS : <T extends PoSType>(posType : T) => node.find(part => part.type === posType) as PoSObjectType<T>,

        getVerb : verbId => node.find(part => part.type === "verb" && part.verb.id === verbId) as MainVerb,

        getDirectObject : entityId => node.find(part => part.type === "directObject" && part.entity.id === entityId) as DirectObject,

        getPreposition : prepos => node.find(part => part.type === "preposition" && part.value === prepos) as Preposition,

        getModifier : (modtype, modValue) => node.find(part => part.type === "modifier" && part.modType === modtype && part.value === modValue) as Modifier,

        getIndirectObject : (entityId : string) => node.find(part => part.type === "indirectObject" && part.entity.id === entityId) as IndirectObject,

        find : predicate => predicate(part) ? part : prev?.find(predicate),

        findAll : predicate => (prev?.findAll(predicate) ?? []).concat(predicate(part)? [part] : []),

        getModifiers : () => node.findAll(part => part.type === "modifier") as Modifier[],

        size : () => ((node.part.type !== "start") ? 1 : 0) + ((node.previous)? node.previous.size() : 0),

        toString  : () => getWords(node).map(idValue => idValue.id).reduce((item, acc) => item + ", " + acc),

        getWords : () => getWords(node)

    }
    return node;
}
