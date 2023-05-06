export interface IdValue<T> {
    readonly id : string, 
    readonly value : T
}

export interface Taggable {
    readonly tags : string[];
}