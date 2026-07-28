// Author-facing tag vocabulary, matching docs/traits.md. Kept local to
// react-app rather than importing engine/src/game/tags.ts, since that's an
// engine-internal module and cli/react-app only depend on tift-engine's
// public API (see CLAUDE.md).

export const ROOM_TAGS = ["start", "dark"];

export const ITEM_TAGS = [
    "carryable",
    "carried",
    "wearable",
    "worn",
    "container",
    "openable",
    "closable",
    "lockable",
    "locked",
    "pushable",
    "transparent",
    "lightSource",
    "visibleWhenDark",
    "hidden",
    "npc",
];

export const DIRECTIONS = [
    "north", "northeast", "east", "southeast",
    "south", "southwest", "west", "northwest",
    "up", "down", "in", "out",
];

// Matches docs/context.md - the fixed set of contexts a verb can be
// restricted to.
export const VERB_CONTEXTS = ["location", "environment", "inventory", "wearing", "container"];

// A custom verb's transitivity, per docs/verbs.md. Note "instant" and other
// VerbTrait values (engine/src/verb.ts) are only ever set internally by
// stdlib verbs - engine/src/game/enginebuilder.ts's makeVerb() only ever
// recognises these two tags from authored YAML.
export const VERB_TRANSITIVITY = ["transitive", "intransitive"];

// The engine's built-in verbs (engine/src/game/defaultverbs.ts /
// verbnames.ts) - these are never authored anywhere in a game's own YAML
// (enabled instead via the "useDefaultVerbs" option), so they can't be
// discovered from the game's own docs the way custom verbs can. Offered as
// matcher suggestions alongside a game's own custom verbs.
export const DEFAULT_VERBS = [
    "go", "look", "inventory", "wait",
    "get", "drop", "put", "examine", "wear", "remove",
    "open", "close", "push", "unlock", "lock",
];
