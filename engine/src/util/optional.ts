import { Optional } from "tift-types/src/util/optional"

export function hasValue<T>(opt : Optional<T>) : opt is T {
    return opt !== null && opt !== undefined;
}

export function ifPresent<T>(opt : Optional<T>, fn : (value : T) => void) {
  if(hasValue(opt)) {
      fn(opt);
  }
}

