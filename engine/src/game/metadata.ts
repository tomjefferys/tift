import { Env } from "tift-types/src/env";
import { Obj } from "../util/objects";

// Utilities for dealing with the metadata object

export const KEY = "__metadata__";

const OPTIONS = "options";

export const get = (env : Env) => env.get(KEY);

export const create = (properties : Obj, name : string) => ({...properties, name, id : KEY});

export const hasOption = (metadata : Obj, option : string) => {
    const options = metadata[OPTIONS] ?? [];
    return options.includes(option);
}
