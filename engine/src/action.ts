import { Env } from "./env"
import { Matcher } from "./commandmatcher"

// Encapsulates an action
// eg
// go(north) => moveTo(library)
// [go, north] => moveTo(library)
// go, north => moveTo(library)
// [go,$dir]

export interface Action {
    readonly matcher : Matcher,
    readonly action : (env : Env) => void
}