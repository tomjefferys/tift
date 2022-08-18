export interface Nameable {
    id : string,
    name? : string
}

export function getName(nameable : Nameable) {
    return nameable.name ?? nameable.id;
}