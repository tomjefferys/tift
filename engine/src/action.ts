import { ActionMatcher } from "./actionmatcher"
import { Env } from "./env"

// Encapsulates an action
// eg
// go(north) => moveTo(library)
// [go, north] => moveTo(library)
// go, north => moveTo(library)
// [go,$dir]

export interface Action {
    readonly matcher : ActionMatcher,
    readonly action : (env : Env) => void
}