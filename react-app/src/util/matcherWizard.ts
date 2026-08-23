// A step-planner (see components/bubbleWizard/BubbleWizard.tsx) for building
// a command-pattern matcher one token at a time: verb, then each argument
// (this/entity id/$capture), then an optional attribute + indirect object -
// the same grammar MatcherEditor.tsx edits as a form, and the same
// MatcherPattern/ObjectSlot data from actions.ts. This file has no UI code -
// it only decides, given the state built so far, what the next bubbles are.
import { WizardOption, WizardStep } from "../components/bubbleWizard/BubbleWizard";
import { MatcherPattern, ObjectSlot, matcherArgs, serializeMatcher, withMatcherArgs } from "./actions";

export type MatcherWizardPhase = "verb" | "args" | "attribute-name" | "attribute-object" | "finished";

export interface MatcherWizardState {
    phase : MatcherWizardPhase;
    pattern : MatcherPattern;
}

// Starting state for the wizard - resumes at the "args" phase if a verb is
// already set (eg re-entering the wizard on an existing matcher), otherwise
// starts fresh. A raw/unparsed matcher isn't representable here - callers
// should start from an empty pattern in that case (switching to bubble mode
// means building the matcher structurally from scratch).
export function initialMatcherWizardState(pattern? : MatcherPattern) : MatcherWizardState {
    const initialPattern = pattern ?? { kind : "pattern", verb : "", modifiers : [] };
    return { phase : initialPattern.verb ? "args" : "verb", pattern : initialPattern };
}

// Common prepositions offered as quick picks for an attribute name - not
// exhaustive (a game can use any preposition), so a free-text option is
// always offered alongside these.
const COMMON_ATTRIBUTES = ["about", "on", "in", "with", "to", "from", "at"];

export interface MatcherWizardContext {
    verbOptions : string[];
    entityOptions : string[];
}

function pickText(
    label : string, placeholder : string,
    onSubmit : (text : string, state : MatcherWizardState) => MatcherWizardState,
) : WizardOption<MatcherWizardState> {
    return { kind : "text", label, placeholder, onSubmit };
}

// The bubbles for choosing one ObjectSlot (this / an entity id / a $capture
// name) - shared between building the argument list and choosing the
// attribute's indirect object, which is the same slot grammar in both spots.
function slotPickOptions(
    entityOptions : string[],
    apply : (state : MatcherWizardState, slot : ObjectSlot) => MatcherWizardState,
) : WizardOption<MatcherWizardState>[] {
    const options : WizardOption<MatcherWizardState>[] = [
        { kind : "pick", label : "this", onSelect : state => apply(state, { kind : "this" }) },
    ];
    for (const id of entityOptions) {
        options.push({ kind : "pick", label : id, onSelect : state => apply(state, { kind : "id", id }) });
    }
    options.push(pickText("capture variable", "eg. direction", (text, state) => apply(state, { kind : "capture", name : text })));
    return options;
}

export function planMatcherStep(context : MatcherWizardContext) : (state : MatcherWizardState) => WizardStep<MatcherWizardState> {
    return (state : MatcherWizardState) : WizardStep<MatcherWizardState> => {
        const preview = state.pattern.verb ? serializeMatcher(state.pattern) : "";

        switch (state.phase) {
            case "verb": {
                const options : WizardOption<MatcherWizardState>[] = [
                    ...context.verbOptions.map((verb) : WizardOption<MatcherWizardState> => ({
                        kind : "pick", label : verb,
                        onSelect : s => ({ ...s, phase : "args", pattern : { ...s.pattern, verb } }),
                    })),
                    pickText("type verb", "eg. push", (text, s) => ({ ...s, phase : "args", pattern : { ...s.pattern, verb : text } })),
                ];
                return { preview, options, canFinish : false };
            }

            case "args": {
                const applyArg = (s : MatcherWizardState, slot : ObjectSlot) : MatcherWizardState => ({
                    ...s, pattern : withMatcherArgs(s.pattern, [...matcherArgs(s.pattern), slot]),
                });
                const options = slotPickOptions(context.entityOptions, applyArg);
                if (!state.pattern.attribute) {
                    options.push({ kind : "pick", label : "add attribute", onSelect : s => ({ ...s, phase : "attribute-name" }) });
                }
                // Already usable as-is (a bare verb, or verb+args, with no
                // attribute) - "finish" is always available once a verb has
                // been chosen, same as MatcherEditor's form never forcing an
                // attribute to be added.
                return { preview, options, canFinish : true };
            }

            case "attribute-name": {
                const setName = (name : string, s : MatcherWizardState) : MatcherWizardState => ({
                    ...s, phase : "attribute-object", pattern : { ...s.pattern, attribute : { name, indirectObject : undefined } },
                });
                const options : WizardOption<MatcherWizardState>[] = [
                    ...COMMON_ATTRIBUTES.map((name) : WizardOption<MatcherWizardState> => ({
                        kind : "pick", label : name, onSelect : s => setName(name, s),
                    })),
                    pickText("type attribute name", "eg. about", (text, s) => setName(text, s)),
                ];
                return { preview, options, canFinish : true };
            }

            case "attribute-object": {
                const applyIndirect = (s : MatcherWizardState, slot : ObjectSlot) : MatcherWizardState => ({
                    ...s, phase : "finished",
                    pattern : { ...s.pattern, attribute : s.pattern.attribute && { ...s.pattern.attribute, indirectObject : slot } },
                });
                const options = slotPickOptions(context.entityOptions, applyIndirect);
                options.push({ kind : "pick", label : "no indirect object", onSelect : s => ({ ...s, phase : "finished" }) });
                return { preview, options, canFinish : true };
            }

            case "finished":
                return { preview, options : [], canFinish : true };
        }
    };
}
