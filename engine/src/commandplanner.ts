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
//
// Future performance enhancements
// --------------------------------
// A perf investigation (see rebindContext in game/context.ts, and the findEntities/findObjs
// changes in game/locations.ts and env.ts) fixed the search re-scanning the whole world on
// every candidate command. Two smaller costs remain, both lower priority because they weren't
// what made a small game like CloakOfDarkness slow, but worth revisiting if a much larger
// game (many rules, or a big verb/entity space) makes this search slow again:
// - run()'s call to executeCommand(..., full=true): the before/after-turn rule phases call
//   getGlobalRules, which rescans every rule in the game via env.findObjs on *each* candidate
//   command - the same "rescan a per-run-invariant set on every fork" shape rebindContext
//   fixed for context, just not yet applied to the rule list. executeCommand also re-parses
//   `command` via searchCommand even though candidateCommands already parsed it once and threw
//   the result away. Both scale with game size (rule count / verb+entity count).
// - stateKey() calls origin.get(path) fresh for every touched path on every successor, even
//   though `origin` never changes for the life of a run - those values could be resolved once
//   and cached by path. This scales with search depth (the touched-path count), not game size.

import * as _ from "lodash";
import { Env } from "tift-types/src/env";
import { Obj, PropType } from "./util/objects";
import { EnvFn } from "./script/thunk";
import { ForkManager, isFound } from "./env";
import { getTouchedPaths } from "./util/overrideproxy";
import { getAllCommands } from "./commandsearch";
import { executeCommand } from "./commandexecutor";
import { getContext, rebindContext } from "./game/context";
import * as Agent from "./game/agent";
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
 * @param actorId the agent to plan for (defaults to whichever actor `env` currently resolves
 *                to - the player, unless bound otherwise - see game/agent.ts#getActorId).
 *                Passed explicitly (rather than relying on an `__actor__` binding on `env`)
 *                because each simulated fork is a fresh root env with no ancestors - see
 *                ForkManager - so a binding on the caller's env wouldn't survive forking.
 * @returns a list of commands (each a list of word ids, eg ["go","north"]) that leads to a
 *          state where `predicate` holds, or undefined if no such plan was found within depth
 */
export function createPlan(
        env : Env, predicate : EnvFn, verbList : string[], depth : number = DEFAULT_PLAN_DEPTH,
        actorId : string = Agent.getActorId(env))
        : string[][] | undefined {
    return new SearchRunner(env, predicate, verbList, depth, actorId).run();
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
    // Every (net) state key seen so far, shared across the whole run. Search proceeds
    // breadth-first, so the first time a key is reached is already via a shortest path -
    // there's no need to track *how* shallow, just that it's been seen.
    private readonly visited = new Set<string>();

    constructor(
            private readonly origin : Env,
            private readonly predicate : EnvFn,
            private readonly verbList : string[],
            private readonly depth : number,
            private readonly actorId : string) {
        this.ignoredProperties = getIgnoredProperties(origin);
        this.forkManager = new ForkManager(origin);
    }

    // Breadth-first search: guarantees the first plan found is a shortest one, and (since
    // states are marked visited as they're enqueued, not as they're expanded) never queues
    // the same net state twice.
    run() : string[][] | undefined {
        const initial = SearchState.initial(Agent.withActor(this.origin, this.actorId));
        this.visited.add(stateKey(this.origin, initial.current, initial.touched));

        const queue = [initial];
        for (let head = 0; head < queue.length; head++) {
            const state = queue[head];
            if (this.predicate(withEntityReferences(state.current)).getValue()) {
                return state.path;
            }
            if (state.path.length >= this.depth) {
                continue;
            }

            const context = getContext(state.current, this.actorId);
            const commands = candidateCommands(state.current, context, this.verbList);

            for (const command of commands) {
                const [forked, overlay] = this.forkManager.fork(state.overlay);
                suppressOutput(forked);
                // Each fork is a fresh root env (see ForkManager), so the actor binding has
                // to be re-applied here rather than inherited from `state.current`.
                const actingEnv = Agent.withActor(forked, this.actorId);
                // A fresh fork is content-identical to `state.current` (nothing has run
                // against it yet), so its context is identical too - rebind the objects
                // `context` already found onto `actingEnv` instead of re-scanning the world.
                const forkedContext = rebindContext(actingEnv, context);
                const handled = executeCommand(actingEnv, forkedContext, command, true);
                if (!handled) {
                    continue;
                }
                const next = state.advance(actingEnv, overlay, command, this.ignoredProperties);
                const key = stateKey(this.origin, next.current, next.touched);
                if (this.visited.has(key)) {
                    continue;
                }
                this.visited.add(key);
                queue.push(next);
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
