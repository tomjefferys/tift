import { OutputConsumer } from "../messages/output";
import * as Output from "../messages/output";


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

function getCauseMessage(e : unknown) : string {
    return e instanceof Error? e.message : String(e);
}
