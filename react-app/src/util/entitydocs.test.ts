import { parseGameDocuments, serializeGameDocuments } from "./gameyaml";
import { listRooms, listItems, listVerbs, upsertRoom, upsertItem, upsertVerb, removeEntity,
         entityIdExists, verbIdExists, listAllEntityIds, RoomFields, ItemFields, VerbFields } from "./entitydocs";

const SAMPLE = `
---
game: Simple Game
gameId: Sample1234
---
room: cave
description: A dark dank cave
exits:
  north: entrance
tags: [start]
before:
  examine(this): print('Just a cave')
---
room: entrance
description: Sunlit entrance
exits:
  south: cave
---
item: key
name: rusty key
description: An old rusty key
location: cave
tags: [carryable]
---
verb: stir
tags: [transitive]
attributes: [with]
actions:
  stir($object).with($tool): print("You stir it")
---
`;

test("listRooms/listItems extract structured fields", () => {
    const docs = parseGameDocuments(SAMPLE);
    const rooms = listRooms(docs);
    const items = listItems(docs);

    expect(rooms.map(r => r.id)).toEqual(["cave", "entrance"]);
    expect(rooms[0].description).toBe("A dark dank cave");
    expect(rooms[0].exits).toEqual({ north: "entrance" });
    expect(rooms[0].tags).toEqual(["start"]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id : "key", name : "rusty key", location : "cave", tags : ["carryable"] });
});

test("listAllEntityIds/entityIdExists span rooms and items together", () => {
    const docs = parseGameDocuments(SAMPLE);
    expect(listAllEntityIds(docs)).toEqual(["cave", "entrance", "key"]);
    expect(entityIdExists(docs, "cave")).toBe(true);
    expect(entityIdExists(docs, "nope")).toBe(false);
});

test("upsertRoom updates an existing room's fields without disturbing unrelated fields (eg before/after)", () => {
    const docs = parseGameDocuments(SAMPLE);
    const updated: RoomFields = {
        id : "cave",
        name : "",
        description : "A newly lit cave",
        tags : ["start", "dark"],
        exits : { north : "entrance", south : "pool" },
    };
    const newDocs = upsertRoom(docs, updated);

    expect(newDocs).toHaveLength(docs.length);
    const rooms = listRooms(newDocs);
    expect(rooms[0].description).toBe("A newly lit cave");
    expect(rooms[0].exits).toEqual({ north : "entrance", south : "pool" });
    expect(rooms[0].tags).toEqual(["start", "dark"]);

    // The untouched "before" clause on the cave room should survive the edit
    const caveDoc = newDocs.find(doc => doc.room === "cave");
    expect(caveDoc?.before).toBeDefined();
});

test("upsertRoom adds a brand new room", () => {
    const docs = parseGameDocuments(SAMPLE);
    const newRoom: RoomFields = { id : "pool", name : "", description : "A deep pool", tags : [], exits : { north : "cave" } };
    const newDocs = upsertRoom(docs, newRoom);

    expect(listRooms(newDocs).map(r => r.id)).toEqual(["cave", "entrance", "pool"]);
});

test("upsertItem updates an existing item, and adding one with an empty location omits the field", () => {
    const docs = parseGameDocuments(SAMPLE);
    const updated: ItemFields = { id : "key", name : "rusty key", description : "A shinier key now", tags : ["carryable"], location : "entrance" };
    const newDocs = upsertItem(docs, updated);
    expect(listItems(newDocs)[0].description).toBe("A shinier key now");
    expect(listItems(newDocs)[0].location).toBe("entrance");

    const newItem: ItemFields = { id : "torch", name : "", description : "A torch", tags : ["carryable", "lightSource"], location : "" };
    const withNewItem = upsertItem(newDocs, newItem);
    const torchDoc = withNewItem.find(doc => doc.item === "torch");
    expect(torchDoc?.location).toBeUndefined();
});

test("removeEntity removes only the targeted room or item", () => {
    const docs = parseGameDocuments(SAMPLE);
    const withoutEntrance = removeEntity(docs, "room", "entrance");
    expect(listRooms(withoutEntrance).map(r => r.id)).toEqual(["cave"]);
    expect(listItems(withoutEntrance)).toHaveLength(1);

    const withoutKey = removeEntity(docs, "item", "key");
    expect(listItems(withoutKey)).toHaveLength(0);
    expect(listRooms(withoutKey)).toHaveLength(2);
});

test("listVerbs extracts structured fields, including inferred transitivity", () => {
    const docs = parseGameDocuments(SAMPLE);
    const verbs = listVerbs(docs);
    expect(verbs).toHaveLength(1);
    expect(verbs[0]).toMatchObject({ id : "stir", transitivity : "transitive", attributes : ["with"] });
});

test("verb ids live in a separate namespace from room/item/rule ids", () => {
    const docs = parseGameDocuments(SAMPLE);
    // "stir" is a verb id, not a room/item/rule id
    expect(entityIdExists(docs, "stir")).toBe(false);
    expect(verbIdExists(docs, "stir")).toBe(true);
    // and a room id shouldn't count as a used verb id either
    expect(verbIdExists(docs, "cave")).toBe(false);
});

test("upsertVerb updates an existing verb without disturbing its actions, and can add a new verb", () => {
    const docs = parseGameDocuments(SAMPLE);
    const updated : VerbFields = { id : "stir", name : "", transitivity : "transitive", attributes : ["with", "using"], modifiers : [], contexts : ["inventory"] };
    const newDocs = upsertVerb(docs, updated);

    const verb = listVerbs(newDocs)[0];
    expect(verb.attributes).toEqual(["with", "using"]);
    expect(verb.contexts).toEqual(["inventory"]);

    const verbDoc = newDocs.find(doc => doc.verb === "stir");
    expect(verbDoc?.actions).toBeDefined();
    // The transitive tag should still be present, and not duplicated
    expect(verbDoc?.tags).toEqual(["transitive"]);

    const newVerb : VerbFields = { id : "fuddle", name : "", transitivity : "intransitive", attributes : [], modifiers : [], contexts : [] };
    const withNewVerb = upsertVerb(newDocs, newVerb);
    expect(listVerbs(withNewVerb).map(v => v.id)).toEqual(["stir", "fuddle"]);
    expect(listVerbs(withNewVerb)[1].transitivity).toBe("intransitive");
});

test("removeEntity can remove a verb", () => {
    const docs = parseGameDocuments(SAMPLE);
    const withoutStir = removeEntity(docs, "verb", "stir");
    expect(listVerbs(withoutStir)).toHaveLength(0);
    expect(listRooms(withoutStir)).toHaveLength(2);
});

test("edits survive a full serialize/reparse round trip", () => {
    const docs = parseGameDocuments(SAMPLE);
    const updated = upsertRoom(docs, { id : "cave", name : "", description : "A newly lit cave", tags : ["start", "dark"], exits : { north : "entrance" } });
    const yamlText = serializeGameDocuments(updated);
    const reparsed = parseGameDocuments(yamlText);

    const cave = listRooms(reparsed).find(r => r.id === "cave");
    expect(cave?.description).toBe("A newly lit cave");
    expect(cave?.tags).toEqual(["start", "dark"]);
});
