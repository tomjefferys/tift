/**
 * Types shared between engine and clients
 */

export interface IdValue<T> {
    readonly id : string, 
    readonly value : T
}

export function mkIdValue<T>(id : string, value : T ) : IdValue<T> {
    return { 
        id : id,
        value : value
    };
}