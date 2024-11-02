import { OutputConsumer } from "tift-types/src/messages/output";
import * as Output from "../messages/output";
import _ from "lodash";
import { isNotFound, NOT_FOUND } from "../env";
import { SOURCE_MAP_KEY } from "../yamlparser";
import { SourceLocation } from "./yamlsourcemap";
import * as SourceMap from "./yamlsourcemap";
import { Env } from "tift-types/src/env";
import * as Path from "../path"
import { PathElement } from "tift-types/src/path";
import { Optional } from "tift-types/src/util/optional";
import { Obj } from "tift-types/src/util/objects";

const UNKNOWN_LOCATION = "Unknown source location";

type ErrorLocation = Optional<Path.Type | SourceLocation | TiftError>;

class TiftError extends Error {

    readonly location : ErrorLocation;

    constructor(message : string, location : ErrorLocation) {
        super(message);
        this.location = location;
    }
}

export function throwError(error : string, source : unknown) : never {
    if (isErrorLocation(source)) {
        throw new TiftError(error, source);
    } else if (source !== undefined) {
        throw new TiftError(`${error}\n${getCauseMessage(source)}`, undefined);
    } else {
        throw new TiftError(error, undefined);
    }
}

export function throwErrorWithObj(error : string, obj : Obj, path : Path.PossiblePath) : never {
    const sourceMap = obj[SOURCE_MAP_KEY];
    const location = sourceMap? SourceMap.getSourceLocation(sourceMap, Path.of(path)) : undefined;
    throwError(error, location);
}

export function rethrowCompileError(expression : string, cause : unknown, path? : Path.PossiblePath) : never {
    rethrowError("Compilation failed", expression, cause, path);
}

export function rethrowExecutionError(expression : string, cause : unknown, path? : Path.PossiblePath) : never {
    rethrowError("Execution failed", expression, cause, path);
}

export function logError(env : Env, output : OutputConsumer, e : unknown) {
    const message = Output.log("error", getCauseMessage(e) + "\n" + getSourceLocation(env, e));
    output(message);
}

function getSourceLocation(env : Env, e : unknown) : string {
    if (!(e instanceof TiftError) || !e.location) {
        return UNKNOWN_LOCATION;
    }
    if (e.location instanceof TiftError) {
        return getSourceLocation(env, e.location);
    }

    const location = SourceMap.isSourceLocation(e.location)
                            ? e.location
                            : getSourceLocationFromPath(env, e.location);
    if (!location) {
        return UNKNOWN_LOCATION;
    }
    const fileName = location.file ?? "unknown";
    return `File: ${fileName}:${location.line}`;
}

function getSourceLocationFromPath(env : Env, path : Path.Type) : SourceLocation {
    const [objPath, valuePath] = splitPath(path);
    const obj = env.get(objPath);
    const sourceMap = obj? obj[SOURCE_MAP_KEY] : {};
    return SourceMap.getSourceLocation(sourceMap, valuePath);
}

// Split a path into two parts, the first is the path to the object within the environment,
//  the second is the path to the value within the object
function splitPath(path : Path.Type) : [PathElement[], PathElement[]] {
    let objPath : PathElement[];
    let valuePath : PathElement[];
    if (path[0].type === "namespace")  {
        const [namespace, objId, ...pathTail] = path;
        objPath = [namespace, objId];
        valuePath = pathTail;
    } else {
        const [objId, ...pathTail] = path;
        objPath = [objId];
        valuePath = pathTail;
    }
    return [objPath, valuePath];
}


function rethrowError(type : string, expression : string, cause : unknown, possiblePath? : Path.PossiblePath) : never {
    const causeMessage = getCauseMessage(cause);
    const path = possiblePath? Path.of(possiblePath) : undefined;
    throw new TiftError(type + ": " + (path? Path.toString(path) + "\n" : "") + expression + "\n" + causeMessage, path);
}

function isErrorLocation(location : unknown) : location is ErrorLocation { 
    return Path.isPath(location)
            || SourceMap.isSourceLocation(location)
            || location instanceof TiftError;
}

/**
 * Returns a suitable string value for an object, if one is available
 * @param value 
 */
export function toStr(value : unknown) : string {
    let result = "unknown";
    if (_.isString(value)) {
        result = value;
    } else if (isNotFound(value)) {
        result = value[NOT_FOUND]
    } else if (_.isObject(value)) {
        if (_.has(value, "id")) {
            result = _.get(value, "id");
        }
    }
    return result;
}

export function getCauseMessage(e : unknown) : string {
    let message = "";
    if (e instanceof TiftError) {
        message += e.message;
        if (e.location && e.location instanceof TiftError) {
            message += "\n" + getCauseMessage(e.location);
        }
    } else if (e instanceof Error) {
        message += e.message;
    } else {
        message += String(e);
    }
    return message;
}


