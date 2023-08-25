import { loadAll } from "js-yaml"
import { Obj } from "./util/objects"

const prototypes = {
  "room":{"type":"room"},
  "object":{"type":"object"},
  "item":{"type":"item"},
  "rule":{"type":"rule"},
  "verb":{"type":"verb"},
  "property":{"type":"property"},
  "game":{"type":"metadata"}
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
        let newDoc : Obj = Object.assign({"id": doc[name]}, pt, doc);
        delete newDoc[name];
        if (name === "game") {
          newDoc = {...newDoc, name : doc[name], id : "__metadata__"};
        }
        docs.push(newDoc);
      }
    } 
  });
  return docs;
}

