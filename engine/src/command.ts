import _ from "lodash";
import { Entity } from "./entity";
import { Verb } from "./verb"


// Part of Speech
type Part = MainVerb | DirectObject | IndirectObject | Preposition | Modifier

export type Command = SentenceNode;

interface SentenceNode {
    part : Part,
    previous? : SentenceNode,
    
    hasVerb(verbId : string) : boolean, 
    hasDirectObject(entityId : string) : boolean,
    hasPreposition(prepos : string) : boolean,
    hasModifier(modtype : string, modValue : string) : boolean,
    hasIndirectObject(entityId : string) : boolean,
    find(predicate : (part : Part) => boolean) : boolean
}

interface MainVerb {
    type : "verb"
    verb : Verb
}

interface DirectObject {
    type : "directObject",
    entity : Entity
}

interface Preposition {
    type : "preposition",
    value : string,
}

interface IndirectObject {
    type : "indirectObject",
    entity : Entity
}

interface Modifier {
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

export function verb(verb : Verb) : SentenceNode & Directable & Prepositionable {
    const mainVerb : MainVerb = {
        type : "verb",
        verb : verb
    }
    return directable(modifiable(prepositionable(makeNode(mainVerb))));
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
        
        hasVerb : verbId => node.find(part => part.type === "verb" && part.verb.id === verbId),

        hasDirectObject : entityId => node.find(part => part.type === "directObject" && part.entity.id === entityId),

        hasPreposition : prepos => node.find(part => part.type === "preposition" && part.value === prepos),

        hasModifier : (modtype, modValue) => node.find(part => part.type === "modifier" && part.modType === modtype && part.value === modValue),

        hasIndirectObject : (entityId : string) => node.find(part => part.type === "indirectObject" && part.entity.id === entityId),

        find : (predicate : (part : Part) => boolean) => predicate(part) || (prev?.find(predicate) ?? false)
    }
    return node;
}

