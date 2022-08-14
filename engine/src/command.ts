import _ from "lodash";
import { SearchState } from "./commandsearch";
import { Entity } from "./entity";
import { Verb } from "./verb"


// Part of Speech
type Part = MainVerb | DirectObject | IndirectObject | Preposition | Modifier | Preposition

export type PoSType = "verb" | "directObject" | "preposition" | "indirectObject" | "modifier";

type PoSObjectType<T> =
        T extends "verb" ? MainVerb :
        T extends "directObject" ? DirectObject : 
        T extends "preposition" ? Preposition : 
        T extends "indirectObject" ? IndirectObject :
        T extends "modifier" ? Modifier :
        never;

export type Command = SentenceNode;

interface SentenceNode {
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

interface Directable {
    object : (entity : Entity) => SentenceNode & Prepositionable & Modifiable;
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

export function verb(verb : Verb) : SentenceNode & Directable & Prepositionable & Modifiable {
    const mainVerb : MainVerb = {
        type : "verb",
        verb : verb
    }
    return directable(modifiable(prepositionable(makeNode(mainVerb))));
}

// Convert a search state to a command object.  This is a bit ugly, but hopefully only temporary
export function fromSearchState(searchState : SearchState) : Command {
    const stage1 = searchState.verb? verb(searchState.verb) : undefined;
    if (!stage1) {
        throw new Error("Invalid search state, no verb specified");
    }

    const stage2 = searchState.directObject? stage1.object(searchState.directObject) : stage1;
    const stage3 = (searchState.attribute && searchState.indirectObject)
                        ? stage2.preposition(searchState.attribute).object(searchState.indirectObject) : stage2;

    return Object.entries(searchState.modifiers)
                 .reduce(
                    (command, modEntry) => command.modifier(modEntry[0], modEntry[1]),
                     stage3);
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

        getModifiers : () => node.findAll(part => part.type === "modifier") as Modifier[]
    }
    return node;
}
