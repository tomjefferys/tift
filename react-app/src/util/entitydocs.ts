import { GameDoc, getDocId, getDocKind } from "./gameyaml";
import { ActionClause, parseActionBlock, serializeActionBlock } from "./actions";

export type EntityKind = "room" | "item" | "verb";

export interface RoomFields {
    id : string;
    name : string;
    description : string;
    tags : string[];
    exits : { [direction : string] : string };
    before : ActionClause[];
    after : ActionClause[];
}

export interface ItemFields {
    id : string;
    name : string;
    description : string;
    tags : string[];
    location : string;
    before : ActionClause[];
    after : ActionClause[];
}

export interface VerbFields {
    id : string;
    name : string;
    transitivity : "transitive" | "intransitive";
    attributes : string[];
    modifiers : string[];
    contexts : string[];
    before : ActionClause[];
    actions : ActionClause[];
    after : ActionClause[];
}

// Serializes an action block, omitting the field entirely when it's empty so
// entities/verbs with no before/actions/after don't gain a stray `before: {}`.
function optionalActionBlock(clauses : ActionClause[]) : Record<string, unknown> | undefined {
    return clauses.length > 0 ? serializeActionBlock(clauses) : undefined;
}

export function listRooms(docs : GameDoc[]) : RoomFields[] {
    return docs.filter(doc => getDocKind(doc) === "room").map(toRoomFields);
}

export function listItems(docs : GameDoc[]) : ItemFields[] {
    return docs.filter(doc => getDocKind(doc) === "item" || getDocKind(doc) === "object").map(toItemFields);
}

export function listVerbs(docs : GameDoc[]) : VerbFields[] {
    return docs.filter(doc => getDocKind(doc) === "verb").map(toVerbFields);
}

function toRoomFields(doc : GameDoc) : RoomFields {
    return {
        id : String(doc.room),
        name : doc.name ?? "",
        description : doc.description ?? "",
        tags : Array.isArray(doc.tags) ? doc.tags : [],
        exits : (doc.exits && typeof doc.exits === "object") ? doc.exits : {},
        before : parseActionBlock(doc.before),
        after : parseActionBlock(doc.after),
    };
}

function toItemFields(doc : GameDoc) : ItemFields {
    return {
        id : String(doc.item ?? doc.object),
        name : doc.name ?? "",
        description : doc.description ?? "",
        tags : Array.isArray(doc.tags) ? doc.tags : [],
        location : doc.location ?? "",
        before : parseActionBlock(doc.before),
        after : parseActionBlock(doc.after),
    };
}

function toVerbFields(doc : GameDoc) : VerbFields {
    const tags : string[] = Array.isArray(doc.tags) ? doc.tags : [];
    return {
        id : String(doc.verb),
        name : doc.name ?? "",
        // Defaults to "transitive" for a not-yet-tagged verb; makeVerb()
        // (engine/src/game/enginebuilder.ts) leaves a verb with neither
        // trait if tags omits both, but the form always writes one back.
        transitivity : tags.includes("intransitive") ? "intransitive" : "transitive",
        attributes : Array.isArray(doc.attributes) ? doc.attributes : [],
        modifiers : Array.isArray(doc.modifiers) ? doc.modifiers : [],
        contexts : Array.isArray(doc.contexts) ? doc.contexts : [],
        before : parseActionBlock(doc.before),
        // The authoring field is "actions", though its internal engine phase
        // is "main" (see engine/src/game/enginebuilder.ts's getActionStrings).
        actions : parseActionBlock(doc.actions),
        after : parseActionBlock(doc.after),
    };
}

// Entity ids share a single namespace in the engine (rooms, items and rules
// all live under "entities" - see engine/src/game/enginebuilder.ts's
// TYPE_NAMESPACES), so uniqueness has to be checked across all of them, not
// just within rooms or items alone. Verbs live in their own separate
// "verbs" namespace, so they're checked independently (see verbIdExists).
export function entityIdExists(docs : GameDoc[], id : string) : boolean {
    return listAllEntityIds(docs).includes(id);
}

export function listAllEntityIds(docs : GameDoc[]) : string[] {
    return docs.map(doc => {
        const kind = getDocKind(doc);
        return (kind === "room" || kind === "item" || kind === "object" || kind === "rule")
                ? getDocId(doc)
                : undefined;
    }).filter((id) : id is string => id !== undefined);
}

export function verbIdExists(docs : GameDoc[], id : string) : boolean {
    return listVerbs(docs).some(verb => verb.id === id);
}

export function upsertRoom(docs : GameDoc[], fields : RoomFields) : GameDoc[] {
    return upsertEntity(docs, "room", fields.id, existing => ({
        ...existing,
        room : fields.id,
        ...optionalFields(fields),
        exits : Object.keys(fields.exits).length > 0 ? fields.exits : undefined,
        before : optionalActionBlock(fields.before),
        after : optionalActionBlock(fields.after),
    }));
}

export function upsertItem(docs : GameDoc[], fields : ItemFields) : GameDoc[] {
    return upsertEntity(docs, "item", fields.id, existing => {
        // Preserve the original "item"/"object" key if this is an edit of an
        // existing entity authored with `object:`, otherwise default to `item:`
        const useObjectKey = existing !== undefined && existing.object !== undefined;
        const { room : _room, item : _item, object : _object, ...rest } = existing ?? {};
        return {
            ...rest,
            ...(useObjectKey ? { object : fields.id } : { item : fields.id }),
            ...optionalFields(fields),
            location : fields.location || undefined,
            before : optionalActionBlock(fields.before),
            after : optionalActionBlock(fields.after),
        };
    });
}

export function upsertVerb(docs : GameDoc[], fields : VerbFields) : GameDoc[] {
    return upsertEntity(docs, "verb", fields.id, existing => {
        const otherTags = ((existing?.tags as string[] | undefined) ?? [])
                            .filter(tag => tag !== "transitive" && tag !== "intransitive");
        return {
            ...existing,
            verb : fields.id,
            name : fields.name || undefined,
            tags : [fields.transitivity, ...otherTags],
            attributes : fields.attributes.length > 0 ? fields.attributes : undefined,
            modifiers : fields.modifiers.length > 0 ? fields.modifiers : undefined,
            contexts : fields.contexts.length > 0 ? fields.contexts : undefined,
            before : optionalActionBlock(fields.before),
            actions : optionalActionBlock(fields.actions),
            after : optionalActionBlock(fields.after),
        };
    });
}

function optionalFields(fields : { name : string, description : string, tags : string[] }) {
    return {
        name : fields.name || undefined,
        description : fields.description || undefined,
        tags : fields.tags.length > 0 ? fields.tags : undefined,
    };
}

function matchesKind(docKind : ReturnType<typeof getDocKind>, kind : EntityKind) : boolean {
    if (kind === "room") return docKind === "room";
    if (kind === "item") return docKind === "item" || docKind === "object";
    return docKind === "verb";
}

function upsertEntity(docs : GameDoc[],
                       kind : EntityKind,
                       id : string,
                       build : (existing : GameDoc | undefined) => GameDoc) : GameDoc[] {
    const index = docs.findIndex(doc => matchesKind(getDocKind(doc), kind) && getDocId(doc) === id);
    if (index === -1) {
        return [...docs, build(undefined)];
    }
    const updated = [...docs];
    updated[index] = build(docs[index]);
    return updated;
}

export function removeEntity(docs : GameDoc[], kind : EntityKind, id : string) : GameDoc[] {
    return docs.filter(doc => !(matchesKind(getDocKind(doc), kind) && getDocId(doc) === id));
}
