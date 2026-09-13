// An override proxy takes an object and intercepts any writes to it
// This will allow changes to the environment to be explored, without changing the original environment
//   In game agents can use this mechanism to search actions (potentially recursively) to find a solution to a goal.
// Updated values are not written to the parent object but saved in the child object
// Get's initially try to return values from the proxy if it's available, and if not
//   return the object from the target object
// Deletes store a special value to indicate that something has been deleted.

import * as objects from "./objects";

type PropType = objects.PropType;
type Obj = objects.Obj;

// Marker stored in an overlay to indicate a property has been deleted from the target
const DELETED = Symbol("deleted");

// Marks an overlay object that was lazily created to hold merged overrides for a nested
// object/array (as opposed to an overlay entry that's an explicit replacement value). This lets
// us tell the difference between `proxy.foo.bar = 1` (a merge into the existing `foo`) and
// `proxy.foo = {bar: 1}` (a wholesale replacement of `foo`). Using a dedicated (private) class
// rather than a plain `{}` keeps the marker off the object's own enumerable keys - so it can't
// pollute Reflect.ownKeys/JSON.stringify/etc - without needing an external set to track it.
// Real game data is always a plain object/array/primitive, never an instance of this class, so
// `instanceof` reliably distinguishes the two.
class MergeOverlay {
    [key : string] : unknown;
    [key : symbol] : unknown;
}

/**
 * Wrap `target` in a proxy that intercepts writes/deletes, storing them in `overlay` instead of
 * mutating `target`. Reads are resolved from `overlay` first, falling back to `target`.
 *
 * `target` may itself be a proxy returned by an earlier call to this function (forking a fork -
 * see env.ts#ForkManager) - every trap below is careful to touch `target` via at most one
 * Reflect.getOwnPropertyDescriptor call, so that reading through a chain of N nested override
 * proxies costs O(N), not O(2^N). Earlier versions of `resolve` and the `getOwnPropertyDescriptor`
 * trap each independently re-derived "does this exist" / "what's the value" - and each of those
 * existence checks (`hasOwnProperty`) round-tripped through the whole underlying chain's own
 * `getOwnPropertyDescriptor` trap, which itself called `resolve` again - compounding into
 * genuine exponential cost once proxies were nested a few levels deep.
 */
function buildProxy(target : Obj, overlay : Obj) : Obj {

    // Wrap a newly-seen own object/array property of `target` in a further override proxy, so
    // that deeper mutations also stay local to the overlay - and remember the (initially empty)
    // child overlay backing it, so repeated reads of the same property resolve consistently.
    const wrapNested = (prop : PropType, value : Obj) : Obj => {
        const childOverlay = new MergeOverlay();
        overlay[prop] = childOverlay;
        return buildProxy(value, childOverlay);
    }

    // Derive the effective value of `prop` from `target`'s own descriptor (already fetched by
    // the caller via a single Reflect.getOwnPropertyDescriptor call - see below). `undefined`
    // means `prop` isn't an own property of `target` - eg an inherited member (Array.prototype
    // methods like `push`), which must be returned as-is: wrapping it would record a spurious
    // overlay entry for a key that isn't really `target`'s own, corrupting enumeration
    // (Object.keys/ownKeys) the moment such a member is read. Functions still work correctly
    // when called (eg `proxy.push(x)`) because they run with `this` bound to the proxy that was
    // accessed, so index/length writes still go through our `set` trap.
    const resolveFromTarget = (targetDescriptor : PropertyDescriptor | undefined, prop : PropType) : unknown => {
        if (!targetDescriptor) {
            return target[prop];
        }
        const value = targetDescriptor.value;
        return objects.isObject(value) ? wrapNested(prop, value) : value;
    }

    // Resolve the current value of `prop`: from the overlay if it's been written there,
    // otherwise falling back to `target`.
    const resolve = (prop : PropType) : unknown => {
        if (Object.prototype.hasOwnProperty.call(overlay, prop)) {
            const overlayValue = overlay[prop];
            if (overlayValue === DELETED) {
                return undefined;
            }
            if (overlayValue instanceof MergeOverlay) {
                return buildProxy(target[prop], overlayValue);
            }
            return overlayValue;
        }
        return resolveFromTarget(Reflect.getOwnPropertyDescriptor(target, prop), prop);
    }

    const isDeleted = (prop : PropType) =>
        Object.prototype.hasOwnProperty.call(overlay, prop) && overlay[prop] === DELETED;

    const handler : ProxyHandler<Obj> = {
        get : (_target : Obj, prop : PropType) => resolve(prop),

        set : (_target : Obj, prop : PropType, value : unknown) => {
            overlay[prop] = value;
            return true;
        },

        deleteProperty : (_target : Obj, prop : PropType) => {
            overlay[prop] = DELETED;
            return true;
        },

        has : (target : Obj, prop : PropType) => {
            if (Object.prototype.hasOwnProperty.call(overlay, prop)) {
                return !isDeleted(prop);
            }
            return prop in target;
        },

        ownKeys : (target : Obj) => {
            const keys = new Set<PropType>([...Reflect.ownKeys(target), ...Reflect.ownKeys(overlay)]);
            return [...keys].filter(key => !isDeleted(key));
        },

        getOwnPropertyDescriptor : (target : Obj, prop : PropType) => {
            if (isDeleted(prop)) {
                return undefined;
            }
            if (Object.prototype.hasOwnProperty.call(overlay, prop)) {
                // `prop` may be a pre-existing property whose value the overlay overrides (eg
                // an array's "length", updated via .push()/.splice() - see the comment on the
                // `set` trap's callers) - in which case its enumerable/configurable flags must
                // still match the real target's (a non-configurable property can't be reported
                // as configurable, and vice versa - see the class comment above). Fall back to
                // enumerable/configurable when `prop` is genuinely new (not on target at all).
                const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);
                return {
                    value : resolve(prop),
                    writable : true,
                    enumerable : targetDescriptor?.enumerable ?? true,
                    configurable : targetDescriptor?.configurable ?? true
                };
            }
            const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);
            if (!targetDescriptor) {
                return undefined;
            }
            return {
                value : resolveFromTarget(targetDescriptor, prop),
                writable : true,
                enumerable : targetDescriptor.enumerable,
                configurable : targetDescriptor.configurable
            };
        }
    };

    return new Proxy(target, handler);
}

/**
 * Create a proxy that overrides the supplied object. Any writes or deletes made via the returned
 * object are captured in a private overlay, leaving `target` (and any objects/arrays nested
 * within it) completely unmodified. Reads that haven't been overridden fall through to `target`.
 *
 * The returned value behaves like a plain object/array — callers don't need to know it's backed
 * by a proxy.
 *
 * `target` must not itself be one of these proxies (or wrap one) - V8 (and the spec) impose
 * expensive `[[GetOwnProperty]]` invariant-checking on a Proxy whose own target is another
 * Proxy, which compounds into genuine exponential cost with each added layer of nesting. To
 * fork an already-forked env (see env.ts#ForkManager, used by commandplanner.ts to simulate a
 * sequence of commands), pass `initialOverlay` instead - a (typically cloned, via
 * `cloneOverlay`) copy of the previous fork's overlay, applied on top of the same real
 * `target` again, so the proxy nesting depth never grows no matter how many times you fork.
 */
export function createOverridableProxy(target : Obj, initialOverlay : Obj = {}) : Obj {
    return buildProxy(target, initialOverlay);
}

/**
 * Deep-clone an overlay (an overlay object passed to/created by createOverridableProxy),
 * preserving which nested objects are "merge" overlays (for nested reads/writes - see
 * `wrapNested` above) versus plain replacement values - a plain `_.cloneDeep` wouldn't preserve
 * that distinction, since it's tracked by the overlay's class (`instanceof MergeOverlay`), which
 * a generic deep-clone wouldn't reconstruct.
 *
 * Used by env.ts#ForkManager to fork a fork: rather than nesting a new proxy over the previous
 * fork's proxy (expensive - see the warning on createOverridableProxy), it clones the
 * accumulated overlay so far and starts a fresh, single-layer proxy directly over the same
 * real target with that cloned overlay as its starting point.
 */
export function cloneOverlay(overlay : Obj) : Obj {
    const clone : Obj = overlay instanceof MergeOverlay ? new MergeOverlay() : {};
    for (const key of Reflect.ownKeys(overlay)) {
        const value = overlay[key];
        clone[key] = value instanceof MergeOverlay ? cloneOverlay(value) : structuredCloneValue(value);
    }
    return clone;
}

// Clone a leaf overlay value (a plain replacement value, or the DELETED marker). Values here
// are always plain game-data (objects/arrays/primitives) or the DELETED symbol - never
// functions or proxies - so a simple recursive clone is sufficient and keeps this module
// dependency-free.
function structuredCloneValue(value : unknown) : unknown {
    if (Array.isArray(value)) {
        return value.map(structuredCloneValue);
    }
    if (objects.isObject(value) && typeof value !== "function") {
        return Object.entries(value).reduce((acc : Obj, [key, v]) => {
            acc[key] = structuredCloneValue(v);
            return acc;
        }, {});
    }
    return value;
}

/**
 * Return every property path that has been written to (set or deleted) via an overlay created
 * by/passed to createOverridableProxy, relative to the object originally passed as `target`.
 * Paths that only exist because a nested object was read (and so lazily wrapped in an empty
 * merge overlay - see `resolve` above) are not included; only paths that were actually written
 * are "touched".
 *
 * Used by the command planner (see ../commandplanner.ts) to work out what changed during a
 * simulated command, without needing to compare the whole game state.
 *
 * @param overlay the overlay backing a proxy returned by createOverridableProxy
 * @returns a list of property paths (each an ordered list of keys, since a path may pass
 *          through several levels of object/array nesting) that were written to
 */
export function getTouchedPaths(overlay : Obj) : PropType[][] {
    const paths : PropType[][] = [];
    for (const key of Reflect.ownKeys(overlay)) {
        const value = overlay[key];
        const path = [key];
        if (value instanceof MergeOverlay) {
            // A merge overlay for a nested object - recurse. If it turns out to be empty
            // (created only because something read through it, never wrote to it), this
            // contributes no paths, which is exactly what we want.
            paths.push(...getTouchedPaths(value).map(subPath => [...path, ...subPath]));
        } else {
            // A leaf write (a value, or the DELETED marker for a delete) - the key itself
            // was actually touched.
            paths.push(path);
        }
    }
    return paths;
}
