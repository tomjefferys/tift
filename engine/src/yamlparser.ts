import { loadAll } from "js-yaml"
import * as fs from "fs"
import { Obj, ObjArray, ObjValue } from "./types"

//const data = fs.readFileSync("test/resources/test.yaml", "utf8");

let prototypes = {
  "room":{"type":"room"},
  "object":{"type":"object"},
  "rule":{"type":"rule"},
  "verb":{"type":"verb"}
}

export function loadObjs(fileName: string) {
  const data = fs.readFileSync(fileName, "utf8");
  return getObjs(data);
}

export function getObjs(data: string) {
  let docs : Obj[] = [];
  loadAll(data, rawDoc => { 
    const doc = rawDoc as Obj
    for(const [name, pt] of Object.entries(prototypes)) {
      if (doc[name]) {
        let newDoc : Obj = Object.assign({"id": doc[name]}, pt, doc);
        delete newDoc[name];
        docs.push(newDoc);
      }
    } 
  });
  return docs;
}

//const docs = loadObjs("test/resources/test.yaml");
//
//for(const doc of docs) {
//  console.log(JSON.stringify(doc, null, 2));
//
//}

