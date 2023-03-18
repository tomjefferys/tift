import { Predicate } from "tift-types/src/util/functions";

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