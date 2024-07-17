import { Obj, KIND } from "../util/objects";

export const VERB_KIND = "verb";

export function isVerb(obj : Obj) : boolean {
  return obj[KIND] === VERB_KIND;
}