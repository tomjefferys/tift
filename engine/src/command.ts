import _ from "lodash";
import { ActionSource, emptyActionSource } from "./actionsource";
import { Entity } from "./entity";
import { getName } from "./nameable";
import { matchAll, not } from "./util/functions";
import { Predicate } from "tift-types/src/util/functions";
import * as Verb from "./verb"
import { PoSType, PartOfSpeech } from "tift-types/src/messages/word";

type Verb = Verb.Verb;

// Part of Speech
type Part =  Start | MainVerb | DirectObject | IndirectObject | Preposition | Modifier | Preposition

type PoSObjectType<T> =
        T extends "start" ? Start :
        T extends "verb" ? MainVerb :
        T extends "directObject" ? DirectObject : 
        T extends "preposition" ? Preposition : 
        T extends "indirectObject" ? IndirectObject :
        T extends "modifier" ? Modifier :
        never;

export type Command = SentenceNode;


/**
 * Represents a sentance/command
 * Points to the last part of the sentence, with each part linking to the previous part
 */
export interface SentenceNode {
    part : Part,
    previous? : SentenceNode,
    contexts : string[],
    
    getPoS<T extends PoSType>(posType : T) : PoSObjectType<T> | undefined,
    getVerb(verbId : string) : MainVerb | undefined, 
    getDirectObject(entityId : string) : DirectObject | undefined,
    getPreposition(prepos : string) : Preposition | undefined,
    getModifier(modtype : string, modValue : string) : Modifier | undefined,
    getIndirectObject(entityId : string) : IndirectObject | undefined,

    getContexts() : string[],

    find(predicate : (part : Part) => boolean) : Part | undefined,

    findAll(predicate : (part : Part) => boolean) : Part[],

    getModifiers() : Modifier[];

    size() : number;

    getWords() : PartOfSpeech[];

    getActions() : ActionSource;

    toString() : string;

    // Return if this is a valid and complete sentence
    // eg transitive verbs have objects, attributes are followed by an indirect object etc
    isValid() : boolean;

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

function getWords(node : SentenceNode) : PartOfSpeech[] {
    let word = undefined;
    const part = node.part;
    const position = getPosition(node);
    switch(part.type) {
        case "start": 
            word = makeWord("start", "", part.type, position);
            break;
        case "verb":
            word = makeWord(part.verb.id, getName(part.verb), part.type, position);
            break;
        case "directObject":
        case "indirectObject":
            word = makeWord(part.entity.id, getName(part.entity), part.type, position);
            break;
        case "preposition":
            word = makeWord(part.value, part.value, part.type, position);
            break;
        case "modifier":
            word = makeWord(part.value, part.value, part.type, position, part.modType);
            break;
    }

    const words = (node.previous && node.previous.part.type !== "start")? getWords(node.previous) : [];
    words.push(word);
    return words;
}

function getPosition(node : SentenceNode) : number {
    return (node.previous)? getPosition(node.previous) + 1 : 0;
}

export function makeWord(id : string, value : string, partOfSpeech : PoSType, position : number, modifierType? : string) : PartOfSpeech {
    if (partOfSpeech === "modifier" && !modifierType) {
        throw new Error("Can't create modifer without a modifier type");
    }
    return { id, value, type : "word", partOfSpeech, position, modifierType };
}

/**
 * Get the actions that are provided by the verbs and entitys in the provided sentence
 * @param node 
 * @returns 
 */
function getActions(node : SentenceNode) : ActionSource {
    const actionSource = (node.previous && node.previous?.part.type !== "start")? getActions(node.previous) : emptyActionSource();

    const part = node.part;
    let next : ActionSource;
    switch(part.type) {
        case "verb":
            next = part.verb;
            break;
        case "directObject":
        case "indirectObject":
            next = part.entity;
            break;
        default:
            next = emptyActionSource();
    }

    return {
        before : [...actionSource.before, ...next.before],
        actions : [...actionSource.actions, ...next.actions],
        after : [...actionSource.after, ...next.after]
    }
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

/**
 * Add a `verb` function to a node.
 * @param node 
 * @returns 
 */
function verbable<T extends SentenceNode>(node : T) : T & Verbable {
    const newNode = {
        ...node,
        verb : (verb : Verb) => directable(modifiable(prepositionable(makeNode({ type : "verb", verb }, node))))
    }
    return newNode;
}

/**
 * Add an `object` function to a node, which adds a direct object to the sentence
 * @param node 
 * @returns 
 */
function directable<T extends SentenceNode>(node : T) : T & Directable {
    const newNode = {
        ...node,
        object : (entity : Entity) => prepositionable(modifiable(makeNode({ type : "directObject", entity }, node)))
    }
    return newNode;
}

/**
 * Add an `object` function to a node, which adds a indirect object to the sentence
 * @param node 
 * @returns 
 */
function indirectable<T extends SentenceNode>(node : T) : T & Indirectable {
    const newNode = {
        ...node,
        object : (entity : Entity) => prepositionable(modifiable(makeNode({ type : "indirectObject", entity }, node)))
    }
    return newNode;
}

/**
 * Add a `preposition` function to a node 
 * @param node 
 * @returns 
 */
function prepositionable<T extends SentenceNode>(node : T) : T & Prepositionable {
    const newNode = {
        ...node,
        preposition : (prepos : string) => indirectable(makeNode({ type : "preposition", value : prepos }, node))
    }
    return newNode
}

/**
 * Add a `modifier` function to a node. The function takes a modifier type and value
 * @param node 
 * @returns 
 */
function modifiable<T extends SentenceNode>(node : T) : T & Modifiable {
    const newNode = {
        ...node,
        modifier : (modType : string, modValue : string) => prepositionable(modifiable(makeNode({ type : "modifier", modType, value : modValue }, node)))
    }
    return newNode;
}

function makeNode(part : Part, prev? : SentenceNode) : SentenceNode {
    const node : SentenceNode = {
        part : part, 
        previous : prev,
        contexts : [],

        getPoS : <T extends PoSType>(posType : T) => node.find(part => part.type === posType) as PoSObjectType<T>,

        getVerb : verbId => node.find(part => part.type === "verb" && part.verb.id === verbId) as MainVerb,

        getDirectObject : entityId => node.find(part => part.type === "directObject" && part.entity.id === entityId) as DirectObject,

        getPreposition : prepos => node.find(part => part.type === "preposition" && part.value === prepos) as Preposition,

        getModifier : (modtype, modValue) => node.find(part => part.type === "modifier" && part.modType === modtype && part.value === modValue) as Modifier,

        getIndirectObject : (entityId : string) => node.find(part => part.type === "indirectObject" && part.entity.id === entityId) as IndirectObject,

        getContexts : () => [...node.contexts, ...(prev?.getContexts() ?? [])],

        find : predicate => predicate(part) ? part : prev?.find(predicate),

        findAll : predicate => (prev?.findAll(predicate) ?? []).concat(predicate(part)? [part] : []),

        getModifiers : () => node.findAll(part => part.type === "modifier") as Modifier[],

        size : () => ((node.part.type !== "start") ? 1 : 0) + ((node.previous)? node.previous.size() : 0),

        toString  : () => getWords(node).map(idValue => idValue.id).reduce((item, acc) => item + ", " + acc),

        getWords : () => getWords(node),

        getActions : () => getActions(node),

        isValid : () => checkValidity(node)

    }
    return node;
}


function accept(pos : PoSType) : Predicate<SentenceNode> {
    return node => !_.isUndefined(node.getPoS(pos));
}

function reject(pos : PoSType) : Predicate<SentenceNode> {
    return node => _.isUndefined(node.getPoS(pos));
}

/**
 * A Sentence validator, first left hand side will match on a verb, then the right hand side can be used to validate a sentence.
 */
type SentenceValidator = [Predicate<Verb>[], Predicate<SentenceNode>[]];

const VALIDATORS : SentenceValidator[] = [
    [[Verb.isIntransitive, not(Verb.isAttributed)],                        [accept("verb"), reject("directObject"), reject("indirectObject")]],
    [[Verb.isIntransitive, Verb.isAttributed],                             [accept("verb"), reject("directObject"), accept("preposition"), accept("indirectObject")]],
    [[Verb.isTransitive, not(Verb.isAttributed)],                          [accept("verb"), accept("directObject"), reject("preposition")]],
    [[Verb.isTransitive, Verb.isAttributed, not(Verb.isIndirectOptional)], [accept("verb"), accept("directObject"), accept("preposition"), accept("indirectObject")]],
    [[Verb.isTransitive, Verb.isAttributed, Verb.isIndirectOptional],      [accept("verb"), accept("directObject"), reject("preposition")]],
    [[Verb.isTransitive, Verb.isAttributed, Verb.isIndirectOptional],      [accept("verb"), accept("directObject"), accept("preposition"), accept("indirectObject")]]
];

function checkValidity(node : SentenceNode) {
    const verb = node.getPoS("verb")?.verb;
    return (verb)
            ? VALIDATORS.filter(([verbMatcher, _sentenceMatcher]) => matchAll(...verbMatcher)(verb))
                     .map(([_verbMatcher, sentenceMatcher]) => sentenceMatcher)
                     .some((sentenceMatcher) => matchAll(...sentenceMatcher)(node))
            : false;
}
