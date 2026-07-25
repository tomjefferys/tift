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
