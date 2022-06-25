import { loadAll } from "js-yaml"
import * as fs from "fs"
import { Obj } from "./types"

const prototypes = {
  "room":{"type":"room"},
  "object":{"type":"object"},
  "item":{"type":"item"},
  "rule":{"type":"rule"},
  "verb":{"type":"verb"}
}

export function loadObjs(fileName: string) {
  const data = fs.readFileSync(fileName, "utf8");
  return getObjs(data);
}

export function getObjs(data: string) {
  const docs : Obj[] = [];
  loadAll(data, rawDoc => { 
    const doc = rawDoc as Obj
    if (!doc) {
      return;
    }
    for(const [name, pt] of Object.entries(prototypes)) {
      if (doc[name]) {
        const newDoc : Obj = Object.assign({"id": doc[name]}, pt, doc);
        delete newDoc[name];
        docs.push(newDoc);
      }
    } 
  });
  return docs;
}

