
export type Optional<T> = T | undefined;

export function hasValue<T>(opt : Optional<T>) : opt is T {
    return opt !== undefined;
}

export function ifPresent<T>(opt : Optional<T>, fn : (value : T) => void) {
  if(hasValue(opt)) {
      fn(opt);
  }
}

