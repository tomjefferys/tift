// Some useful function types
export type Consumer<T> = (item : T) => void;
export type BiConsumer<S,T> = (item1 : S, item2 : T) => void;

export type Producer<T> = () => T;

export type Predicate<T> = (t : T) => boolean;