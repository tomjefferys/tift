import { MultiDict } from "./util/multidict";
import { Obj } from "./util/objects";
import { Nameable } from "./nameable";
import { ActionSource } from "./actionsource";
import { Env } from "tift-types/src/env";
import { Thunk } from "./script/thunk";
import _ from "lodash"

export type RuleFn = (env : Env) => unknown;

export enum PROPS {
  ID = "id",
  TAGS = "tags",
  TYPE = "type"
}

export interface Entity extends Nameable, ActionSource {
  id : string,
  verbs : VerbMatcher[],
  verbModifiers : MultiDict<string>,
  [props : string]: unknown
}

export function getType(entity : Entity) : string {
    const type = entity[PROPS.TYPE];
    if (!type) {
      throw new Error("Entity: " + entity.id + " has no type");
    }
    return type as string;
  }

export function hasTag(entity : Obj, tag : string) : boolean {
    const tags = (entity[PROPS.TAGS] ?? []) as string[];
    return tags.indexOf(tag) != -1;
}

export interface VerbMatcher {
  readonly verb : string;
  readonly attribute? : string;
  readonly condition? : Thunk;
}

export function buildVerbMatcher(verb : string, attribute? : string, condition? : Thunk) : VerbMatcher {
  return { verb, attribute, condition };
}
