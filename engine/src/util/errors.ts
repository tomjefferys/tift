import { OutputConsumer } from "tift-types/src/messages/output";
import * as Output from "../messages/output";
import _ from "lodash";
import { isNotFound, NOT_FOUND } from "../env";


export function rethrowCompileError(expression : string, cause : unknown, path? : string) : never {
    rethrowError("Compilation failed", expression, cause, path);
}

export function rethrowExecutionError(expression : string, cause : unknown, path? : string) : never {
    rethrowError("Execution failed", expression, cause, path);
}

export function logError(output : OutputConsumer, e : unknown) {
    const message = Output.log("error", getCauseMessage(e));
    output(message);
}

function rethrowError(type : string, expression : string, cause : unknown, path? : string) : never {
    const causeMessage = getCauseMessage(cause);
    throw new Error(type + ": " + (path? path + "\n" : "") + expression + "\n" + causeMessage);
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
    return e instanceof Error? e.message : String(e);
}
