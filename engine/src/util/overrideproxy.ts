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

// The set of overlay objects that were lazily created to hold merged overrides for a nested
// object/array (as opposed to overlay entries that are explicit replacement values). This lets
// us tell the difference between `proxy.foo.bar = 1` (a merge into the existing `foo`) and
// `proxy.foo = {bar: 1}` (a wholesale replacement of `foo`) without polluting the overlay
// objects themselves with marker properties.
const mergeOverlays = new WeakSet<object>();

/**
 * Wrap `target` in a proxy that intercepts writes/deletes, storing them in `overlay` instead of
 * mutating `target`. Reads are resolved from `overlay` first, falling back to `target`.
 */
function buildProxy(target : Obj, overlay : Obj) : Obj {

    // Resolve the current value of `prop`, wrapping nested objects in a further override proxy
    // so that deeper mutations also stay local to the overlay.
    const resolve = (prop : PropType) : unknown => {
        if (Object.prototype.hasOwnProperty.call(overlay, prop)) {
            const overlayValue = overlay[prop];
            if (overlayValue === DELETED) {
                return undefined;
            }
            if (objects.isObject(overlayValue) && mergeOverlays.has(overlayValue)) {
                return buildProxy(target[prop], overlayValue);
            }
            return overlayValue;
        }
        const value = target[prop];
        // Only wrap own object-valued properties in a merge overlay. Inherited members (eg
        // Array.prototype methods like `push`) must be returned as-is: wrapping them would
        // record a spurious overlay entry for a key that isn't really an own property of
        // `target`, corrupting enumeration (Object.keys/ownKeys) the moment such a member is
        // read. Functions still work correctly when called (eg `proxy.push(x)`) because they
        // run with `this` bound to the proxy that was accessed, so index/length writes still
        // go through our `set` trap.
        if (objects.isObject(value) && Object.prototype.hasOwnProperty.call(target, prop)) {
            const childOverlay = {};
            mergeOverlays.add(childOverlay);
            overlay[prop] = childOverlay;
            return buildProxy(value, childOverlay);
        }
        return value;
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
            const hasOverlay = Object.prototype.hasOwnProperty.call(overlay, prop);
            if (!hasOverlay && !Object.prototype.hasOwnProperty.call(target, prop)) {
                return undefined;
            }
            const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);
            return {
                value : resolve(prop),
                writable : true,
                enumerable : targetDescriptor?.enumerable ?? true,
                configurable : targetDescriptor?.configurable ?? true
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
 */
export function createOverridableProxy(target : Obj) : Obj {
    return buildProxy(target, {});
}
