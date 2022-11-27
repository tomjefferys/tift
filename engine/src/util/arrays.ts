// Array utility methods

import { hasValue, Optional } from "./optional";

/**
 * Checks if two arrays have matching prefixes
 * (["eat", "apple"],[]) => true
 * (["eat", "apple"], ["eat"]) => true
 * (["eat", "apple"], ["eat", "apple"]) => true
 * (["eat", "apple"], ["eat", "apple", "carefully"]) => true
 * (["eat", "apple"], ["eat", "bread"]) => false
 * @param arr1 
 * @param arr2 
 */
export function prefixEquals<T>(arr1 : T[], arr2 : T[]) : boolean {
    const arr1Slice = arr1.slice(0, arr2.length);
    const arr2Slice = arr2.slice(0, arr1.length);
    return equals(arr1Slice, arr2Slice);
}

/**
 * Checks if the first array is a prefix of the second
 * @param arr1 the prefix
 * @param arr2 the array to check it agains
 * @returns
 */
export function isPrefixOf<T>(arr1 : T[], arr2 : T[]) : boolean {
    const arr2Slice = arr2.slice(0, arr1.length);
    return equals(arr1, arr2Slice);
}

/**
 * shallow equals on two arrays
 * @param arr1 
 * @param arr2 
 * @returns 
 */
export function equals<T>(arr1 : T[], arr2 : T[]) : boolean {
    return arr1.length === arr2.length && arr1.every((entry, index) => entry === arr2[index]);
}

/**
 * Creates an array of the supplied optional items, ignoring any that are undefined
 * @param items and array of optionals
 * @returns an array containing only non-optional values
 */
export function of<T>(...items : Optional<T>[]) : T[] {
    return items.filter(item => hasValue(item)) as T[];
}

export function pushIfUnique<T>(arr : T[], item : T, isEqual : (item1 : T, item2 : T) => boolean) {
    if (!arr.find(arrItem => isEqual(item, arrItem))) {
        arr.push(item);
    }
}