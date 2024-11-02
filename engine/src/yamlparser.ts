import { Obj } from "./util/objects"
import * as Metadata from "./game/metadata"
import * as YAML from "yaml"
import { LineCounter } from "yaml";
import * as SourceMap from "./util/yamlsourcemap";

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

export const SOURCE_MAP_KEY = "__sourceMap__";

export function getObjs(data: string) {
  const lc = new LineCounter();
  const yamlDocs = YAML.parseAllDocuments(data, { lineCounter : lc});
  return yamlDocs.filter(doc => doc != null)
                 .map(doc => [doc.toJSON(), SourceMap.getSourceMap(doc, lc)])
                 .filter(([obj, _sourceMap]) => obj != null)
                 .map(([obj, sourceMap]) => ({...obj, [SOURCE_MAP_KEY]: sourceMap}))
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



