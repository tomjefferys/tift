import { parseGameDocuments, serializeGameDocuments, getDocKind, getDocId } from "./gameyaml";

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
---
item: key
name: rusty key
description: An old rusty key
location: cave
tags: [carryable]
---
`;

test("parseGameDocuments splits a multi-document YAML blob into raw docs", () => {
    const docs = parseGameDocuments(SAMPLE);
    expect(docs).toHaveLength(3);
    expect(docs[0].game).toBe("Simple Game");
    expect(docs[1].room).toBe("cave");
    expect(docs[2].item).toBe("key");
});

test("getDocKind/getDocId identify each document", () => {
    const docs = parseGameDocuments(SAMPLE);
    expect(getDocKind(docs[0])).toBe("game");
    expect(getDocKind(docs[1])).toBe("room");
    expect(getDocId(docs[1])).toBe("cave");
    expect(getDocKind(docs[2])).toBe("item");
    expect(getDocId(docs[2])).toBe("key");
});

test("serializeGameDocuments round-trips back into equivalent, parseable YAML", () => {
    const docs = parseGameDocuments(SAMPLE);
    const yamlText = serializeGameDocuments(docs);
    const reparsed = parseGameDocuments(yamlText);

    expect(reparsed).toHaveLength(3);
    expect(reparsed[1]).toEqual(docs[1]);
    expect(reparsed[2]).toEqual(docs[2]);
});
