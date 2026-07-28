// Parsing/serializing layer for the `before`/`actions`/`after` command-pattern
// blocks used on verbs, rooms and items (see engine/src/game/enginebuilder.ts's
// getActionStrings, engine/src/script/matchParser.ts, engine/src/game/
// rulebuilder.ts). Mirrors the engine's authoring grammar without importing
// any engine internals - react-app only ever depends on the loosely-typed
// authored YAML shape (GameDoc), same as gameyaml.ts/entitydocs.ts.
//
// Anything this module can't confidently model (an unusual matcher string, an
// unrecognised rule shape) is preserved as a "raw" fallback rather than
// dropped or mangled, so a save always round-trips whatever it doesn't
// understand - the same principle entitydocs.ts uses for unknown fields.

const IDENT_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// --- Command-pattern matcher (the key side of a before/actions/after entry) ---

export type ObjectSlot =
    | { kind : "this" }
    | { kind : "id", id : string }
    | { kind : "capture", name : string };

export interface MatcherPattern {
    kind : "pattern";
    verb : string;
    // Note: whether the first argument is semantically a "direct object" or
    // just the first modifier depends on the referenced verb's transitivity,
    // which isn't known from the matcher string alone (the verb may be a
    // stdlib verb not authored anywhere in this game's YAML). We always treat
    // the first argument positionally as `directObject` and any remaining
    // ones as `modifiers` - this preserves argument order for round-tripping
    // regardless of the label, matching how engine/src/script/matchParser.ts
    // itself only splits args this way at match-time.
    directObject? : ObjectSlot;
    modifiers : ObjectSlot[];
    attribute? : { name : string, indirectObject? : ObjectSlot };
}

export interface RawMatcher {
    kind : "raw";
    text : string;
}

export type Matcher = MatcherPattern | RawMatcher;

function parseSlot(token : string) : ObjectSlot | undefined {
    const trimmed = token.trim();
    if (trimmed === "") {
        return undefined;
    }
    if (trimmed === "this") {
        return { kind : "this" };
    }
    if (trimmed.startsWith("$")) {
        const name = trimmed.slice(1);
        return IDENT_PATTERN.test(name) ? { kind : "capture", name } : undefined;
    }
    return IDENT_PATTERN.test(trimmed) ? { kind : "id", id : trimmed } : undefined;
}

function serializeSlot(slot : ObjectSlot) : string {
    switch (slot.kind) {
        case "this": return "this";
        case "id": return slot.id;
        case "capture": return "$" + slot.name;
    }
}

interface ParsedCall {
    name : string;
    args : string[];
}

// Parses `name`, `name()` or `name(arg1, arg2, ...)`. Arguments in this
// grammar are always bare tokens (this / id / $capture) - never nested calls
// or expressions - so a simple non-greedy paren match is sufficient.
function parseCall(str : string) : ParsedCall | undefined {
    const trimmed = str.trim();
    if (IDENT_PATTERN.test(trimmed)) {
        return { name : trimmed, args : [] };
    }
    const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([^()]*)\)$/);
    if (!match) {
        return undefined;
    }
    const [, name, argsText] = match;
    const args = argsText.trim() === "" ? [] : argsText.split(",").map(arg => arg.trim());
    return { name, args };
}

// Splits `verb(args).attribute(args)` into its two call parts. Since argument
// tokens never themselves contain a `)` or `.`, the first `).` sequence (if
// any) unambiguously marks the boundary between the verb call and the
// attribute call.
function splitMatcherText(str : string) : { verbPart : string, attrPart? : string } {
    const boundary = str.indexOf(").");
    if (boundary === -1) {
        return { verbPart : str };
    }
    return {
        verbPart : str.slice(0, boundary + 1),
        attrPart : str.slice(boundary + 2),
    };
}

export function parseMatcher(text : string) : Matcher {
    const raw : RawMatcher = { kind : "raw", text };
    const { verbPart, attrPart } = splitMatcherText(text.trim());

    const verbCall = parseCall(verbPart);
    if (!verbCall) {
        return raw;
    }
    const verbSlots = verbCall.args.map(parseSlot);
    if (verbSlots.some(slot => slot === undefined)) {
        return raw;
    }
    const [directObject, ...modifiers] = verbSlots as ObjectSlot[];

    let attribute : MatcherPattern["attribute"];
    if (attrPart !== undefined) {
        const attrCall = parseCall(attrPart);
        if (!attrCall) {
            return raw;
        }
        const attrSlots = attrCall.args.map(parseSlot);
        if (attrSlots.some(slot => slot === undefined)) {
            return raw;
        }
        attribute = { name : attrCall.name, indirectObject : attrSlots[0] as ObjectSlot | undefined };
    }

    return { kind : "pattern", verb : verbCall.name, directObject, modifiers, attribute };
}

// A UI-friendly view of a pattern's arguments as one ordered list, since the
// directObject/modifiers split is positional only (see the note on
// MatcherPattern above) - editing them as a single "arguments" list is both
// simpler for an author and just as faithful to the underlying string.
export function matcherArgs(pattern : MatcherPattern) : ObjectSlot[] {
    return [pattern.directObject, ...pattern.modifiers].filter((slot) : slot is ObjectSlot => slot !== undefined);
}

export function withMatcherArgs(pattern : MatcherPattern, args : ObjectSlot[]) : MatcherPattern {
    const [directObject, ...modifiers] = args;
    return { ...pattern, directObject, modifiers };
}

export function serializeMatcher(matcher : Matcher) : string {
    if (matcher.kind === "raw") {
        return matcher.text;
    }
    const args = [matcher.directObject, ...matcher.modifiers].filter((slot) : slot is ObjectSlot => slot !== undefined);
    const verbPart = args.length > 0 ? `${matcher.verb}(${args.map(serializeSlot).join(", ")})` : matcher.verb;
    if (!matcher.attribute) {
        return verbPart;
    }
    const indirectArg = matcher.attribute.indirectObject ? serializeSlot(matcher.attribute.indirectObject) : "";
    return `${verbPart}.${matcher.attribute.name}(${indirectArg})`;
}

// --- Rule values (the value side of a before/actions/after entry) ---
//
// A rule (engine/src/game/rulebuilder.ts) is a string, an array of rules, or
// a "component rule" object built from a fixed set of clause keywords, each
// belonging to one of three roles: condition (when/if/unless), action
// (all/do/then/switch/repeat/random/once), otherwise (otherwise/else). The
// engine rejects two clauses of the same role in one object - we mirror that
// by falling back to "raw" (preserved verbatim) for anything ambiguous,
// rather than guessing.

export type RuleValue =
    | { kind : "commands", commands : string[] }
    | { kind : "conditional", condType : "when" | "if" | "unless", condition : string, action : RuleValue, otherwise? : RuleValue }
    | { kind : "switch", cases : RuleValue[] }
    | { kind : "repeat", steps : RuleValue[] }
    | { kind : "random", choices : RuleValue[] }
    | { kind : "once", action : RuleValue }
    | { kind : "raw", value : unknown };

const CONDITION_KEYS = ["when", "if", "unless"] as const;
const ACTION_KEYS = ["all", "do", "then", "switch", "repeat", "random", "once"] as const;
const OTHERWISE_KEYS = ["otherwise", "else"] as const;
const RECOGNIZED_CLAUSE_KEYS = new Set<string>([...CONDITION_KEYS, ...ACTION_KEYS, ...OTHERWISE_KEYS]);

type ConditionType = typeof CONDITION_KEYS[number];

function asRuleList(value : unknown) : unknown[] {
    return Array.isArray(value) ? value : [value];
}

function buildActionCore(actionKey : typeof ACTION_KEYS[number], value : unknown) : RuleValue {
    switch (actionKey) {
        case "switch": return { kind : "switch", cases : asRuleList(value).map(parseRuleValue) };
        case "repeat": return { kind : "repeat", steps : asRuleList(value).map(parseRuleValue) };
        case "random": return { kind : "random", choices : asRuleList(value).map(parseRuleValue) };
        case "once": return { kind : "once", action : parseRuleValue(value) };
        // "all"/"then" are accepted synonyms for "do" - all three just mean
        // "run this rule".
        default: return parseRuleValue(value);
    }
}

function parseComponentRule(obj : Record<string, unknown>) : RuleValue {
    const conditionKeys = CONDITION_KEYS.filter(key => key in obj);
    const actionKeys = ACTION_KEYS.filter(key => key in obj);
    const otherwiseKeys = OTHERWISE_KEYS.filter(key => key in obj);
    const hasUnrecognizedKeys = Object.keys(obj).some(key => !RECOGNIZED_CLAUSE_KEYS.has(key));

    // Mirror rulebuilder.ts's own validation: at most one clause per role,
    // and at least one action clause. Anything ambiguous or carrying keys we
    // don't recognise is preserved untouched as raw rather than guessed at.
    if (hasUnrecognizedKeys || conditionKeys.length > 1 || actionKeys.length > 1 || otherwiseKeys.length > 1 || actionKeys.length === 0) {
        return { kind : "raw", value : obj };
    }

    const actionKey = actionKeys[0];
    const core = buildActionCore(actionKey, obj[actionKey]);

    const conditionKey = conditionKeys[0];
    const otherwiseKey = otherwiseKeys[0];
    if (conditionKey === undefined) {
        // "otherwise" without a condition doesn't make sense - preserve as
        // raw rather than silently dropping it.
        return otherwiseKey === undefined ? core : { kind : "raw", value : obj };
    }

    return {
        kind : "conditional",
        condType : conditionKey as ConditionType,
        condition : String(obj[conditionKey]),
        action : core,
        otherwise : otherwiseKey !== undefined ? parseRuleValue(obj[otherwiseKey]) : undefined,
    };
}

export function parseRuleValue(value : unknown) : RuleValue {
    if (typeof value === "string") {
        return { kind : "commands", commands : [value] };
    }
    if (Array.isArray(value)) {
        return value.every(item => typeof item === "string")
            ? { kind : "commands", commands : value as string[] }
            : { kind : "raw", value };
    }
    if (value !== null && typeof value === "object") {
        return parseComponentRule(value as Record<string, unknown>);
    }
    return { kind : "raw", value };
}

function actionEntryFor(core : RuleValue) : { key : string, value : unknown } {
    switch (core.kind) {
        case "switch": return { key : "switch", value : core.cases.map(serializeRuleValue) };
        case "repeat": return { key : "repeat", value : core.steps.map(serializeRuleValue) };
        case "random": return { key : "random", value : core.choices.map(serializeRuleValue) };
        case "once": return { key : "once", value : serializeRuleValue(core.action) };
        // Always write "do" for a plain run-this-rule action - "all"/"then"
        // are accepted synonyms on read, but a save doesn't need to remember
        // which one the author originally typed.
        default: return { key : "do", value : serializeRuleValue(core) };
    }
}

export function serializeRuleValue(rv : RuleValue) : unknown {
    switch (rv.kind) {
        case "commands":
            return rv.commands.length === 1 ? rv.commands[0] : rv.commands;
        case "conditional": {
            const obj : Record<string, unknown> = { [rv.condType] : rv.condition };
            const entry = actionEntryFor(rv.action);
            obj[entry.key] = entry.value;
            if (rv.otherwise) {
                // Always write "otherwise" (never the "else" synonym), same
                // canonicalisation reasoning as the action key above.
                obj["otherwise"] = serializeRuleValue(rv.otherwise);
            }
            return obj;
        }
        case "switch": return { switch : rv.cases.map(serializeRuleValue) };
        case "repeat": return { repeat : rv.steps.map(serializeRuleValue) };
        case "random": return { random : rv.choices.map(serializeRuleValue) };
        case "once": return { once : serializeRuleValue(rv.action) };
        case "raw": return rv.value;
    }
}

// --- Action clauses & blocks (a whole before/actions/after field) ---

export interface ActionClause {
    matcher : Matcher;
    rule : RuleValue;
}

// A last-resort clause for input that isn't a valid `Matcher => Command`
// string and isn't a recognised map/array shape either. This should never
// occur for game data that has passed through the engine's own validation
// (Input.validate) - it exists purely so a save never throws away data it
// doesn't understand. Note: if more than one such clause ends up in the same
// block they'll collide under the same "" key on save, since serialization
// always normalises to map form - an acceptable limitation given how rare
// this path is expected to be.
function opaqueClause(value : unknown) : ActionClause {
    return { matcher : { kind : "raw", text : "" }, rule : { kind : "raw", value } };
}

function splitMatcherCommand(str : string) : [string, string] | undefined {
    const arrowIndex = str.indexOf("=>");
    if (arrowIndex === -1) {
        return undefined;
    }
    return [str.slice(0, arrowIndex).trim(), str.slice(arrowIndex + 2).trim()];
}

// Parses a single `Matcher => Command` string, the form accepted when
// before/actions/after is given as a plain string or an array of strings
// (engine/src/script/phaseaction.ts).
function parseStringClause(str : string) : ActionClause {
    const parts = splitMatcherCommand(str);
    if (!parts) {
        return opaqueClause(str);
    }
    const [matcherText, commandText] = parts;
    return { matcher : parseMatcher(matcherText), rule : { kind : "commands", commands : [commandText] } };
}

// Parses a `before`/`actions`/`after` field's raw YAML value into a flat list
// of clauses, regardless of which of the three accepted authoring shapes it
// used (single string, array of strings, or a matcher-keyed map).
export function parseActionBlock(raw : unknown) : ActionClause[] {
    if (raw === undefined || raw === null) {
        return [];
    }
    if (typeof raw === "string") {
        return [parseStringClause(raw)];
    }
    if (Array.isArray(raw)) {
        return raw.map(item => typeof item === "string" ? parseStringClause(item) : opaqueClause(item));
    }
    if (typeof raw === "object") {
        return Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({
            matcher : parseMatcher(key),
            rule : parseRuleValue(value),
        }));
    }
    return [opaqueClause(raw)];
}

// Serializes a clause list back into the map form of before/actions/after.
// Map form is always used on save (rather than trying to preserve the
// original string/array form) since it's the only shape that can represent
// every clause uniformly and is fully equivalent as far as the engine is
// concerned.
export function serializeActionBlock(clauses : ActionClause[]) : Record<string, unknown> {
    const result : Record<string, unknown> = {};
    for (const clause of clauses) {
        result[serializeMatcher(clause.matcher)] = serializeRuleValue(clause.rule);
    }
    return result;
}
