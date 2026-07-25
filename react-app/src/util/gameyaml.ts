import * as YAML from "yaml";

// A single multi-document YAML doc, as authored (eg `{ room: "cave",
// description: "...", exits: {...} }`), kept as a loose bag of properties so
// fields the structured editor doesn't understand (before/after/actions/
// verbs/modifiers/scope/etc.) are preserved untouched across a save.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameDoc = { [key : string] : any };

export type DocKind = "room" | "object" | "item" | "verb" | "rule" | "property" | "game" | "global" | "unknown";

const KIND_KEYS : DocKind[] = ["room", "object", "item", "verb", "rule", "property", "game"];

export function parseGameDocuments(yamlText : string) : GameDoc[] {
    return YAML.parseAllDocuments(yamlText)
               .filter(doc => doc.toJS() != null)
               .map(doc => doc.toJS() as GameDoc);
}

export function serializeGameDocuments(docs : GameDoc[]) : string {
    return docs.map(doc => "---\n" + YAML.stringify(doc)).join("");
}

export function getDocKind(doc : GameDoc) : DocKind {
    const key = KIND_KEYS.find(key => doc[key] !== undefined);
    return key ?? "unknown";
}

export function getDocId(doc : GameDoc) : string | undefined {
    const kind = getDocKind(doc);
    return kind !== "unknown" && kind !== "game" ? String(doc[kind]) : undefined;
}
