// Search for a sequence of commands that achieves some goal, by recursively simulating
// commands against override-proxied forks of the game state (see env.ts#ForkManager and
// util/overrideproxy.ts) - the real state is never touched.
//
// This is the "search" half of autonomous NPC/agent behaviour: having found a plan, an agent
// (or a game script) can hand the resulting command list to executeCommand (see
// commandexecutor.ts) one command at a time to actually carry it out. For now this searches
// from whatever context `env` currently resolves to (ie the player) - there's no notion of
// planning on behalf of an NPC yet.
//
// "The real state is never touched" holds for every function - top-level entity functions,
// functions on a nested sub-object (eg `child: { "foo()": ... }`), and global (stdlib-style)
// functions alike - because all of them resolve their scope dynamically from the caller's root
// on each call (see game/functionbuilder.ts#makeDynamicScope and script/parser.ts#DYNAMIC_ROOT),
// so reads see the simulated state and writes land in the fork's overlay, never the real object
// graph.

import * as _ from "lodash";
import { Env } from "tift-types/src/env";
import { Obj, PropType } from "./util/objects";
import { EnvFn } from "./script/thunk";
import { ForkManager, isFound } from "./env";
import { getTouchedPaths } from "./util/overrideproxy";
import { getAllCommands } from "./commandsearch";
import { executeCommand } from "./commandexecutor";
import { getContext } from "./game/context";
import * as Metadata from "./game/metadata";
import * as GameOutput from "./game/output";
import * as Path from "./path";
import type { CommandContext } from "./engine";

export const DEFAULT_PLAN_DEPTH = 10;

/**
 * Search (depth first) for a sequence of commands that makes `predicate` true.
 *
 * @param env the env to search from (its current state is never mutated)
 * @param predicate an unresolved predicate (a thunk's resolve fn) re-evaluated against each
 *                   simulated future state - see script/parser.ts#markLazy, which is what lets
 *                   createPlan's caller pass a predicate without it being evaluated eagerly
 *                   against the current state
 * @param verbList only commands starting with one of these verb ids are tried at each step;
 *                  an empty list means try every command available in context (this is the
 *                  main lever for controlling the branching factor of the search)
 * @param depth the maximum number of commands to try before giving up
 * @returns a list of commands (each a list of word ids, eg ["go","north"]) that leads to a
 *          state where `predicate` holds, or undefined if no such plan was found within depth
 */
export function createPlan(
        env : Env, predicate : EnvFn, verbList : string[], depth : number = DEFAULT_PLAN_DEPTH)
        : string[][] | undefined {
    return new SearchRunner(env, predicate, verbList, depth).run();
}

// Properties that shouldn't count towards state identity when checking for loops - eg a
// per-turn counter/clock, which would otherwise make every simulated state look distinct and
// defeat loop detection entirely. Declared by the game as a top level `ignoredProperties`
// list (alongside eg `maxScore`), and matched by exact path or by prefix (so an entry like
// "entities.clock" ignores that whole entity, "entities.clock.time" targets one field).
function getIgnoredProperties(env : Env) : string[] {
    const metadata = env.get(Metadata.KEY);
    const value = isFound(metadata) ? (metadata as Obj)["ignoredProperties"] : undefined;
    return Array.isArray(value) ? value as string[] : [];
}

// Owns everything that's constant for one createPlan run - the origin state to diff against,
// the search parameters, the fork factory, and the shared visited-states map used for loop
// detection - so the depth-first search itself doesn't need to thread them through every
// recursive call. The bits that change as the search descends (current env, path, touched
// paths) live in SearchState instead.
class SearchRunner {
    private readonly ignoredProperties : string[];
    private readonly forkManager : ForkManager;
    // Shallowest depth (path length) at which each (net) state has been visited so far,
    // shared across the whole run so a state reached again via a different path is still
    // recognised as already explored.
    private readonly visited = new Map<string, number>();

    constructor(
            private readonly origin : Env,
            private readonly predicate : EnvFn,
            private readonly verbList : string[],
            private readonly depth : number) {
        this.ignoredProperties = getIgnoredProperties(origin);
        this.forkManager = new ForkManager(origin);
    }

    run() : string[][] | undefined {
        return this.search(SearchState.initial(this.origin));
    }

    private search(state : SearchState) : string[][] | undefined {
        if (this.predicate(withEntityReferences(state.current)).getValue()) {
            return state.path;
        }
        if (state.path.length >= this.depth) {
            return undefined;
        }

        // If we've already fully explored this (net) state at least as shallow as this,
        // there's nothing new to find by expanding it again.
        const key = stateKey(this.origin, state.current, state.touched);
        const shallowestSeenAt = this.visited.get(key);
        if (shallowestSeenAt !== undefined && shallowestSeenAt <= state.path.length) {
            return undefined;
        }
        this.visited.set(key, state.path.length);

        const context = getContext(state.current);
        const commands = candidateCommands(state.current, context, this.verbList);

        for (const command of commands) {
            const [forked, overlay] = this.forkManager.fork(state.overlay);
            suppressOutput(forked);
            const forkedContext = getContext(forked);
            const handled = executeCommand(forked, forkedContext, command, true);
            if (!handled) {
                continue;
            }
            const result = this.search(
                    state.advance(forked, overlay, command, this.ignoredProperties));
            if (result) {
                return result;
            }
        }
        return undefined;
    }
}

// The per-node state of the depth-first search: everything that changes as the search
// descends one command deeper. (Run-invariants and the shared visited map live on
// SearchRunner instead - see above.)
class SearchState {
    private constructor(
            readonly current : Env,             // the (forked) env this node explores
            readonly overlay : Obj | undefined, // overlay backing `current` - passed back into
                                                 // ForkManager.fork to fork this node further
            readonly path : string[][],         // commands taken to reach this node
            readonly touched : Set<string>) {}  // net game-state paths touched down this branch

    static initial(origin : Env) : SearchState {
        return new SearchState(origin, undefined, [], new Set<string>());
    }

    // The state reached by taking `command` into the freshly `forked` env (backed by
    // `overlay`), folding this step's writes into the running touched-paths set.
    advance(forked : Env, overlay : Obj, command : string[], ignoredProperties : string[])
            : SearchState {
        const touched = mergeTouched(this.touched, getTouchedPaths(overlay), ignoredProperties);
        return new SearchState(forked, overlay, [...this.path, command], touched);
    }
}

// Every fully-formed command currently available in context, filtered down to those whose
// verb is in verbList (or all of them, if verbList is empty). Reuses the same enumeration the
// tap-word UI uses to offer valid next words (commandsearch.ts#getAllCommands).
function candidateCommands(env : Env, context : CommandContext, verbList : string[]) : string[][] {
    const allCommands = getAllCommands(context.entities, context.verbs, env)
                            .map(words => words.map(word => word.id));
    return verbList.length === 0
                ? allCommands
                : allCommands.filter(command => verbList.includes(command[0]));
}

// Bare entity ids (eg `anItem` rather than `entities.anItem`) only resolve inside a scope
// that's been set up with an "entities" namespace-reference child - normally done for us by
// whatever ran the action/rule we were called from (see phaseaction.ts and
// commandexecutor.ts#executeRule). A forked env is a fresh standalone root with no such
// ancestor, so the predicate needs the same wrapping applied explicitly before each
// evaluation (harmless to redo if an ancestor already provides it).
function withEntityReferences(env : Env) : Env {
    return env.newChild(env.createNamespaceReferences(["entities"]));
}

// Simulated commands shouldn't produce visible output - the search is invisible bookkeeping,
// not something that should narrate every dead-end it tries.
function suppressOutput(env : Env) : void {
    GameOutput.makeOutputConsumer(env.properties, () => { /* discard */ });
}

// Fold this step's touched paths into the running set carried down this branch of the search,
// dropping anything that shouldn't count towards state identity.
function mergeTouched(touched : Set<string>, rawPaths : PropType[][], ignoredProperties : string[]) : Set<string> {
    const next = new Set(touched);
    for (const rawPath of rawPaths) {
        // Symbol-keyed paths (eg the OUTPUT consumer we just injected above) aren't game
        // state - skip them.
        if (rawPath.some(segment => typeof segment === "symbol")) {
            continue;
        }
        const pathStr = (rawPath as string[]).join(".");
        if (isIgnoredProperty(pathStr, ignoredProperties)) {
            continue;
        }
        next.add(pathStr);
    }
    return next;
}

function isIgnoredProperty(pathStr : string, ignoredProperties : string[]) : boolean {
    return ignoredProperties.some(ignored => pathStr === ignored || pathStr.startsWith(ignored + "."));
}

// A key identifying the current (net) state, for loop detection. Rather than serialising the
// whole game state (which would scale with the size of the game), this only looks at
// properties that were actually touched somewhere along this branch of the search, comparing
// each one's current value back to the untouched origin state - so eg "go east" followed by
// "go west" nets out to no difference at all, and is correctly recognised as being back at
// the start, regardless of how large the rest of the game is.
function stateKey(origin : Env, current : Env, touched : Set<string>) : string {
    const parts : string[] = [];
    for (const pathStr of touched) {
        const path = Path.makePath(pathStr.split("."));
        const currentValue = current.get(path);
        const originValue = origin.get(path);
        if (!_.isEqual(currentValue, originValue)) {
            parts.push(pathStr + "=" + canonicalValue(currentValue));
        }
    }
    // Sort so the key doesn't depend on the (arbitrary) iteration order of `touched`.
    return parts.sort().join("|");
}

// Placeholders for values JSON.stringify can't represent in the canonical state key:
// JSON.stringify(undefined) and JSON.stringify(aFunction) both yield JS `undefined`, which
// would silently drop the value from the key and let two distinct states hash equal. The
// leading NUL byte can't appear in any real game string, so neither marker can ever collide
// with genuine state data.
const UNDEFINED_MARKER = " undefined";
const FUNCTION_MARKER = " function";

function canonicalValue(value : unknown) : string {
    return value === undefined ? UNDEFINED_MARKER : JSON.stringify(sortDeep(value));
}

// Deep-sort object keys (and drop functions, which can't meaningfully be compared) so that
// two structurally-identical values always produce the same JSON string, regardless of
// property insertion order.
function sortDeep(value : unknown) : unknown {
    if (_.isFunction(value)) {
        return FUNCTION_MARKER;
    }
    if (_.isArray(value)) {
        return value.map(sortDeep);
    }
    if (_.isObject(value)) {
        return Object.keys(value).sort().reduce((acc : Obj, key) => {
            acc[key] = sortDeep((value as Obj)[key]);
            return acc;
        }, {});
    }
    return value;
}
