import { GameDoc, getDocId, getDocKind } from "./gameyaml";

export interface RoomFields {
    id : string;
    name : string;
    description : string;
    tags : string[];
    exits : { [direction : string] : string };
}

export interface ItemFields {
    id : string;
    name : string;
    description : string;
    tags : string[];
    location : string;
}

export function listRooms(docs : GameDoc[]) : RoomFields[] {
    return docs.filter(doc => getDocKind(doc) === "room").map(toRoomFields);
}

export function listItems(docs : GameDoc[]) : ItemFields[] {
    return docs.filter(doc => getDocKind(doc) === "item" || getDocKind(doc) === "object").map(toItemFields);
}

function toRoomFields(doc : GameDoc) : RoomFields {
    return {
        id : String(doc.room),
        name : doc.name ?? "",
        description : doc.description ?? "",
        tags : Array.isArray(doc.tags) ? doc.tags : [],
        exits : (doc.exits && typeof doc.exits === "object") ? doc.exits : {},
    };
}

function toItemFields(doc : GameDoc) : ItemFields {
    return {
        id : String(doc.item ?? doc.object),
        name : doc.name ?? "",
        description : doc.description ?? "",
        tags : Array.isArray(doc.tags) ? doc.tags : [],
        location : doc.location ?? "",
    };
}

// Entity ids share a single namespace in the engine (rooms, items and rules
// all live under "entities" - see engine/src/game/enginebuilder.ts's
// TYPE_NAMESPACES), so uniqueness has to be checked across all of them, not
// just within rooms or items alone.
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

export function upsertRoom(docs : GameDoc[], fields : RoomFields) : GameDoc[] {
    return upsertEntity(docs, "room", fields.id, existing => ({
        ...existing,
        room : fields.id,
        ...optionalFields(fields),
        exits : Object.keys(fields.exits).length > 0 ? fields.exits : undefined,
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

function upsertEntity(docs : GameDoc[],
                       kind : "room" | "item",
                       id : string,
                       build : (existing : GameDoc | undefined) => GameDoc) : GameDoc[] {
    const index = docs.findIndex(doc => {
        const docKind = getDocKind(doc);
        const matchesKind = kind === "room" ? docKind === "room" : (docKind === "item" || docKind === "object");
        return matchesKind && getDocId(doc) === id;
    });
    if (index === -1) {
        return [...docs, build(undefined)];
    }
    const updated = [...docs];
    updated[index] = build(docs[index]);
    return updated;
}

export function removeEntity(docs : GameDoc[], kind : "room" | "item", id : string) : GameDoc[] {
    return docs.filter(doc => {
        const docKind = getDocKind(doc);
        const matchesKind = kind === "room" ? docKind === "room" : (docKind === "item" || docKind === "object");
        return !(matchesKind && getDocId(doc) === id);
    });
}
