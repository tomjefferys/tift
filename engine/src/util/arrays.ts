// Array utility methods

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
 * shallow equals on two arrays
 * @param arr1 
 * @param arr2 
 * @returns 
 */
export function equals<T>(arr1 : T[], arr2 : T[]) : boolean {
    return arr1.length === arr2.length && arr1.every((entry, index) => entry === arr2[index]);
}