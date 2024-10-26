import { Obj } from "./util/objects"
import * as Metadata from "./game/metadata"
import * as YAML from "yaml"

const prototypes = {
  "room":{"type":"room"},
  "object":{"type":"object"},
  "item":{"type":"item"},
  "rule":{"type":"rule"},
  "verb":{"type":"verb"},
  "property":{"type":"property"},
  "game":{"type":"metadata"},
  "global":{"type":"global"}
}

export function getObjs(data: string) {
  const yamlDocs = YAML.parseAllDocuments(data);
  return yamlDocs.map(doc => doc.toJSON())
                 .filter(doc => doc != null)
                 .map(doc => applyPrototype(doc));
}

function applyPrototype(obj : Obj) : Obj {
  const match = Object.entries(prototypes).find(([name, _pt]) => obj[name])
  if (!match) {
    return obj;
  }

  const [name, pt] = match;
  let newObj : Obj = Object.assign({"id": obj[name]}, pt, obj);
  delete newObj[name];
  if (name === "game") {
    newObj = Metadata.create(newObj, obj[name]);
  }
  return newObj;
}



