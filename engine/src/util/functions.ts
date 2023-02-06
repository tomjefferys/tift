// Some useful function types
export type Consumer<T> = (item : T) => void;
export type BiConsumer<S,T> = (item1 : S, item2 : T) => void;

export type Producer<T> = () => T;

export type Predicate<T> = (t : T) => boolean;

/**
 * Combines several predicates with a boolean `and`
 */
export function matchAll<T>(...predicates : Predicate<T>[]) : Predicate<T> {
    return t => predicates.every(p => p(t));
}

/**
 * Combines several predicates with a boolean `or`
 */
export function matchAny<T>(...predicates: Predicate<T>[]) : Predicate<T> {
    return t => predicates.some(p => p(t));
}

/**
 * Performs logical not on a predicate
 */
export function not<T>(predicate : Predicate<T>) : Predicate<T> {
    return t => !predicate(t);
}