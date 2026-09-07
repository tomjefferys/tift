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
type Part =  Start | MainVerb | DirectObject | IndirectObject | Preposition | Modifier
           | SubVerb | SubObject | SubModifier | SubPreposition | SubIndirectObject

type PoSObjectType<T> =
        T extends "start" ? Start :
        T extends "verb" ? MainVerb :
        T extends "directObject" ? DirectObject :
        T extends "preposition" ? Preposition :
        T extends "indirectObject" ? IndirectObject :
        T extends "modifier" ? Modifier :
        T extends "subVerb" ? SubVerb :
        T extends "subObject" ? SubObject :
        T extends "subModifier" ? SubModifier :
        T extends "subPreposition" ? SubPreposition :
        T extends "subIndirectObject" ? SubIndirectObject :
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
    getSubVerb(verbId : string) : SubVerb | undefined,
    getSubObject(entityId : string) : SubObject | undefined,
    getSubModifier(modtype : string, modValue : string) : SubModifier | undefined,
    getSubPreposition(prepos : string) : SubPreposition | undefined,
    getSubIndirectObject(entityId : string) : SubIndirectObject | undefined,

    getContexts() : string[],

    find(predicate : (part : Part) => boolean) : Part | undefined,

    findAll(predicate : (part : Part) => boolean) : Part[],

    getModifiers() : Modifier[];
    getSubModifiers() : SubModifier[];

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

// Sub-command parts, used by "clausal" verbs to represent a nested command,
// eg "tell robot to go north" -> verb(tell) directObject(robot) preposition(to)
//                                 subVerb(go) subModifier(direction, north)
export interface SubVerb {
    type : "subVerb"
    verb : Verb
}

export interface SubObject {
    type : "subObject",
    entity : Entity
}

export interface SubModifier {
    type : "subModifier"
    modType : string,
    value : string
}

export interface SubPreposition {
    type : "subPreposition",
    value : string,
}

export interface SubIndirectObject {
    type : "subIndirectObject",
    entity : Entity
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
    preposition : (prepos : string) => SentenceNode & Indirectable & SubVerbable;
}

interface Modifiable {
    modifier : (modType : string, modValue : string) => SentenceNode & Prepositionable & Modifiable
}

// A "clausal" verb (eg "tell") accepts a sub-command after its preposition,
// eg "tell robot to go north", mirroring the top-level Verbable/Directable/
// Prepositionable/Modifiable chain one level down.
interface SubVerbable {
    subVerb : (verb : Verb) => SentenceNode & SubDirectable & SubPrepositionable & SubModifiable
}

interface SubDirectable {
    subObject : (entity : Entity) => SentenceNode & SubPrepositionable & SubModifiable
}

interface SubIndirectable {
    subObject : (entity : Entity) => SentenceNode & SubPrepositionable & SubModifiable;
}

interface SubPrepositionable {
    subPreposition : (prepos : string) => SentenceNode & SubIndirectable;
}

interface SubModifiable {
    subModifier : (modType : string, modValue : string) => SentenceNode & SubPrepositionable & SubModifiable
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
        case "subVerb":
            word = makeWord(part.verb.id, getName(part.verb), part.type, position);
            break;
        case "subObject":
            word = makeWord(part.entity.id, getName(part.entity), part.type, position);
            break;
        case "subModifier":
            word = makeWord(part.value, part.value, part.type, position, part.modType);
            break;
        case "subPreposition":
            word = makeWord(part.value, part.value, part.type, position);
            break;
        case "subIndirectObject":
            word = makeWord(part.entity.id, getName(part.entity), part.type, position);
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

export function castSubVerbable<T extends SentenceNode>(node : T) : T & SubVerbable {
    if (!("subVerb" in node && node.part.type === "preposition") ) {
        throw new Error(node + " can't accept a sub-verb, it must be a preposition");
    }
    return node as T & SubVerbable;
}

export function castSubDirectable<T extends SentenceNode>(node : T) : T & SubDirectable {
    if (!("subObject" in node && node.part.type === "subVerb") ) {
        throw new Error(node + " can't accept a sub-command direct object, it must be a sub-verb");
    }
    return node as T & SubDirectable;
}

export function castSubIndirectable<T extends SentenceNode>(node : T) : T & SubIndirectable {
    if (!("subObject" in node && node.part.type === "subPreposition") ) {
        throw new Error(node + " can't accept a sub-command indirect object, it must be a sub-preposition");
    }
    return node as T & SubIndirectable;
}

export function castSubPrepositional<T extends SentenceNode>(node : T) : T & SubPrepositionable {
    if (!("subPreposition" in node)) {
        throw new Error(node + " can't accept a sub-command preposition");
    }
    return node as T & SubPrepositionable;
}

export function castSubModifiable<T extends SentenceNode>(node : T) : T & SubModifiable {
    if (!("subModifier" in node)) {
        throw new Error(node + " can't accept a sub-command modifier");
    }
    return node as T & SubModifiable;
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
        preposition : (prepos : string) => subVerbable(indirectable(makeNode({ type : "preposition", value : prepos }, node)))
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

/**
 * Add a `subVerb` function to a node, which adds the verb of a sub-command to the sentence,
 * eg the "go" in "tell robot to go north"
 * @param node
 * @returns
 */
function subVerbable<T extends SentenceNode>(node : T) : T & SubVerbable {
    const newNode = {
        ...node,
        subVerb : (verb : Verb) => subDirectable(subPrepositionable(subModifiable(makeNode({ type : "subVerb", verb }, node))))
    }
    return newNode;
}

/**
 * Add a `subObject` function to a node, which adds a direct object to the sub-command
 * @param node
 * @returns
 */
function subDirectable<T extends SentenceNode>(node : T) : T & SubDirectable {
    const newNode = {
        ...node,
        subObject : (entity : Entity) => subPrepositionable(subModifiable(makeNode({ type : "subObject", entity }, node)))
    }
    return newNode;
}

/**
 * Add a `subObject` function to a node, which adds an indirect object to the sub-command
 * @param node
 * @returns
 */
function subIndirectable<T extends SentenceNode>(node : T) : T & SubIndirectable {
    const newNode = {
        ...node,
        subObject : (entity : Entity) => subPrepositionable(subModifiable(makeNode({ type : "subIndirectObject", entity }, node)))
    }
    return newNode;
}

/**
 * Add a `subPreposition` function to a node, for the sub-command's own attribute,
 * eg the "with" in "tell robot to stir soup with spoon"
 * @param node
 * @returns
 */
function subPrepositionable<T extends SentenceNode>(node : T) : T & SubPrepositionable {
    const newNode = {
        ...node,
        subPreposition : (prepos : string) => subIndirectable(makeNode({ type : "subPreposition", value : prepos }, node))
    }
    return newNode
}

/**
 * Add a `subModifier` function to a node. The function takes a modifier type and value
 * @param node
 * @returns
 */
function subModifiable<T extends SentenceNode>(node : T) : T & SubModifiable {
    const newNode = {
        ...node,
        subModifier : (modType : string, modValue : string) => subPrepositionable(subModifiable(makeNode({ type : "subModifier", modType, value : modValue }, node)))
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

        getSubVerb : verbId => node.find(part => part.type === "subVerb" && part.verb.id === verbId) as SubVerb,

        getSubObject : entityId => node.find(part => part.type === "subObject" && part.entity.id === entityId) as SubObject,

        getSubModifier : (modtype, modValue) => node.find(part => part.type === "subModifier" && part.modType === modtype && part.value === modValue) as SubModifier,

        getSubPreposition : prepos => node.find(part => part.type === "subPreposition" && part.value === prepos) as SubPreposition,

        getSubIndirectObject : (entityId : string) => node.find(part => part.type === "subIndirectObject" && part.entity.id === entityId) as SubIndirectObject,

        getContexts : () => [...node.contexts, ...(prev?.getContexts() ?? [])],

        find : predicate => predicate(part) ? part : prev?.find(predicate),

        findAll : predicate => (prev?.findAll(predicate) ?? []).concat(predicate(part)? [part] : []),

        getModifiers : () => node.findAll(part => part.type === "modifier") as Modifier[],

        getSubModifiers : () => node.findAll(part => part.type === "subModifier") as SubModifier[],

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
    [[Verb.isTransitive, Verb.isAttributed, Verb.isIndirectOptional],      [accept("verb"), accept("directObject"), accept("preposition"), accept("indirectObject")]],
    // A "clausal" verb (eg "tell") takes a sub-command instead of an indirect object,
    // eg "tell robot to go north"
    [[Verb.isClausal],                                                     [accept("verb"), accept("directObject"), accept("preposition"), accept("subVerb")]]
];

function checkValidity(node : SentenceNode) {
    const verb = node.getPoS("verb")?.verb;
    if (!verb) {
        return false;
    }
    const structurallyValid = VALIDATORS.filter(([verbMatcher, _sentenceMatcher]) => matchAll(...verbMatcher)(verb))
                     .map(([_verbMatcher, sentenceMatcher]) => sentenceMatcher)
                     .some((sentenceMatcher) => matchAll(...sentenceMatcher)(node));
    // A verb that requires a modifier (eg "go", "push") isn't a complete command
    // until a modifier (eg a direction) has actually been chosen.
    const modifierValid = !Verb.isModifierRequired(verb) || node.getModifiers().length > 0;
    return structurallyValid && modifierValid && checkSubCommandValidity(node);
}

// The same shape of validators as VALIDATORS above, but for the sub-command of a clausal
// verb (eg "tell"), one level down: subVerb/subObject/subPreposition/subIndirectObject
// instead of verb/directObject/preposition/indirectObject.
const SUB_VALIDATORS : SentenceValidator[] = [
    [[Verb.isIntransitive, not(Verb.isAttributed)],                        [accept("subVerb"), reject("subObject"), reject("subIndirectObject")]],
    [[Verb.isIntransitive, Verb.isAttributed],                             [accept("subVerb"), reject("subObject"), accept("subPreposition"), accept("subIndirectObject")]],
    [[Verb.isTransitive, not(Verb.isAttributed)],                          [accept("subVerb"), accept("subObject"), reject("subPreposition")]],
    [[Verb.isTransitive, Verb.isAttributed, not(Verb.isIndirectOptional)], [accept("subVerb"), accept("subObject"), accept("subPreposition"), accept("subIndirectObject")]],
    [[Verb.isTransitive, Verb.isAttributed, Verb.isIndirectOptional],      [accept("subVerb"), accept("subObject"), reject("subPreposition")]],
    [[Verb.isTransitive, Verb.isAttributed, Verb.isIndirectOptional],      [accept("subVerb"), accept("subObject"), accept("subPreposition"), accept("subIndirectObject")]]
];

// For a clausal verb (eg "tell"), check that the chosen sub-verb (if any) itself forms
// a complete sub-command, eg "tell robot to go" isn't complete until a direction has
// been chosen, mirroring the top-level checkValidity logic above, one level down.
function checkSubCommandValidity(node : SentenceNode) : boolean {
    const subVerb = node.getPoS("subVerb")?.verb;
    if (!subVerb) {
        return true;
    }
    const structurallyValid = SUB_VALIDATORS.filter(([verbMatcher, _sentenceMatcher]) => matchAll(...verbMatcher)(subVerb))
                     .map(([_verbMatcher, sentenceMatcher]) => sentenceMatcher)
                     .some((sentenceMatcher) => matchAll(...sentenceMatcher)(node));
    const modifierValid = !Verb.isModifierRequired(subVerb) || node.getSubModifiers().length > 0;
    return structurallyValid && modifierValid;
}
