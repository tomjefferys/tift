const DEFAULT_ARTICLE = "the";

export interface Nameable {
    id : string,
    name? : string,
    article? : string
}

/**
 * Return the short name for the nameable object, or the id if no name is set
 * @param nameable 
 * @returns 
 */
export function getName(nameable : Nameable) {
    return nameable.name ?? nameable.id;
}

/**
 * Return the full name for the nameable object, including the article
 * @param nameable 
 * @returns 
 */
export function getFullName(nameable : Nameable) {
    const article = nameable.article ?? DEFAULT_ARTICLE;
    return `${article} ${getName(nameable)}`;
}