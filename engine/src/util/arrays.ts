// Array utility methods

import { Optional } from "tift-types/src/util/optional";
import { hasValue } from "./optional";
import _ from "lodash";

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

export function wildcardPrefixEquals<T>(arr1 : T[], arr2 : T[], wildcard : T) : boolean {
    const arr1Slice = arr1.slice(0, arr2.length);
    const arr2Slice = arr2.slice(0, arr1.length);
    return wildcardEquals(arr1Slice, arr2Slice, wildcard);
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
 * shallow equals on two arrays, allows for a wildcard value
 */
export function wildcardEquals<T>(arr1 : T[], arr2 : T[], wildcard : T) : boolean {
    return arr1.length === arr2.length 
            && arr1.every((entry, index) => _.isEqual(entry, wildcard) 
                                            || _.isEqual(entry, arr2[index])
                                            || _.isEqual(arr2[index], wildcard));
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

/**
 * Perform and in-place filter.  Keeping any values that match the predicate
 * @param arr an array
 * @param predicate a function do decide which values should be kept
 */
export function keep<T>(arr : T[], predicate : (value : T) => boolean ) {
    let i = 0, j = 0;
    while(i < arr.length) {
        const value = arr[i++];
        if (predicate(value)) {
            arr[j++] = value;
        }
    }
    arr.length = j;
}

/**
 * Remove all items from an array that match a predicate
 * @param arr the array
 * @param predicate a function to decide which values should be removed 
 */
export function remove<T>(arr : T[], predicate : (value : T) => boolean) {
    keep(arr, value => !predicate(value));
}