// A step-planner (see components/bubbleWizard/BubbleWizard.tsx) for building
// a leaf expression - a "commands" list entry, or a conditional's condition
// (see actions.ts's RuleValue) - one token at a time: pick a kind, then fill
// in that kind's pieces. Function-call arguments and binary-operation/
// assignment operands recurse into a fresh instance of this SAME planner via
// the shell's "subwizard" mechanism, since an argument/operand is itself a
// full expression. This file has no UI code - it only decides, given the
// state built so far, what the next bubbles are; the actual data model
// (ExprValue, parseExpression/serializeExpression) lives in expressions.ts
// and is unchanged by this file.
import { subwizard, WizardOption, WizardStep } from "../components/bubbleWizard/BubbleWizard";
import { ASSIGN_OPS, BINARY_OPS, EXPR_FUNCTIONS, ExprValue, LiteralType, serializeExpression } from "./expressions";

const KINDS = ["output", "literal", "ref", "call", "operation", "assign", "raw"] as const;
type Kind = typeof KINDS[number];

export type ExpressionWizardPhase =
    | "kind"
    | "output-text"
    | "literal-type" | "literal-value"
    | "ref"
    | "call-fn" | "call-args"
    | "operation-op" | "operation-left" | "operation-right"
    | "assign-target" | "assign-op" | "assign-value"
    | "raw-text"
    | "finished";

export interface ExpressionWizardState {
    phase : ExpressionWizardPhase;
    value : ExprValue;
}

function defaultForKind(kind : Kind) : ExprValue {
    switch (kind) {
        case "output": return { kind : "output", text : "" };
        case "literal": return { kind : "literal", type : "string", value : "" };
        case "ref": return { kind : "ref", path : "" };
        case "call": return { kind : "call", fn : "print", args : [] };
        case "operation": return { kind : "operation", op : "==", left : { kind : "literal", type : "string", value : "" }, right : { kind : "literal", type : "string", value : "" } };
        case "assign": return { kind : "assign", target : "", op : "=", value : { kind : "literal", type : "string", value : "" } };
        case "raw": return { kind : "raw", text : "" };
    }
}

const NEXT_PHASE_FOR_KIND : Record<Kind, ExpressionWizardPhase> = {
    output : "output-text",
    literal : "literal-type",
    ref : "ref",
    call : "call-fn",
    operation : "operation-op",
    assign : "assign-target",
    raw : "raw-text",
};

// Starting state - resumes at "call-args" for an existing call (the main
// practical reason to re-open an already-built expression via the wizard is
// to add one more argument), otherwise resumes at "finished" (the wizard's
// primary purpose is composing a new expression from scratch or extending a
// call's arguments; restructuring an existing operation/assignment/etc in
// place is still available via the form-based ExpressionEditor).
export function initialExpressionWizardState(value? : ExprValue) : ExpressionWizardState {
    // An empty string (a freshly added, not-yet-written "commands" entry)
    // parses to a raw fallback with empty text - treat that the same as no
    // value at all (start at the kind picker), rather than resuming at
    // "finished" with nothing meaningful built.
    if (value === undefined || (value.kind === "raw" && value.text === "")) {
        return { phase : "kind", value : { kind : "raw", text : "" } };
    }
    return { phase : value.kind === "call" ? "call-args" : "finished", value };
}

function pickText(
    label : string, placeholder : string,
    onSubmit : (text : string, state : ExpressionWizardState) => ExpressionWizardState,
) : WizardOption<ExpressionWizardState> {
    return { kind : "text", label, placeholder, onSubmit };
}

export interface ExpressionWizardContext {
    entityOptions : string[];
}

export function planExpressionStep(context : ExpressionWizardContext) : (state : ExpressionWizardState) => WizardStep<ExpressionWizardState> {
    const plan = (state : ExpressionWizardState) : WizardStep<ExpressionWizardState> => {
        const preview = serializeExpression(state.value);

        switch (state.phase) {
            case "kind": {
                const options = KINDS.map((kind) : WizardOption<ExpressionWizardState> => ({
                    kind : "pick", label : kind,
                    onSelect : () => ({ phase : NEXT_PHASE_FOR_KIND[kind], value : defaultForKind(kind) }),
                }));
                return { preview, options, canFinish : false };
            }

            case "output-text": {
                const options = [pickText("type output text", "eg. You see a coin.",
                    (text, s) => ({ ...s, phase : "finished", value : { kind : "output", text } }))];
                return { preview, options, canFinish : false };
            }

            case "literal-type": {
                const options = (["string", "number", "boolean"] as LiteralType[]).map((type) : WizardOption<ExpressionWizardState> => ({
                    kind : "pick", label : type,
                    onSelect : s => ({
                        ...s,
                        phase : type === "boolean" ? "finished" : "literal-value",
                        value : { kind : "literal", type, value : type === "boolean" ? "true" : "" },
                    }),
                }));
                return { preview, options, canFinish : false };
            }

            case "literal-value": {
                const literalType = state.value.kind === "literal" ? state.value.type : "string";
                const options : WizardOption<ExpressionWizardState>[] = literalType === "boolean"
                    ? ["true", "false"].map(v => ({
                        kind : "pick", label : v,
                        onSelect : s => ({ ...s, phase : "finished", value : { kind : "literal", type : "boolean", value : v } }),
                    }))
                    : [pickText("type value", literalType === "number" ? "eg. 5" : "eg. You take it",
                        (text, s) => ({ ...s, phase : "finished", value : { kind : "literal", type : literalType, value : text } }))];
                return { preview, options, canFinish : false };
            }

            case "ref": {
                const options : WizardOption<ExpressionWizardState>[] = [
                    { kind : "pick", label : "this", onSelect : s => ({ ...s, phase : "finished", value : { kind : "ref", path : "this" } }) },
                    ...context.entityOptions.map((id) : WizardOption<ExpressionWizardState> => ({
                        kind : "pick", label : id, onSelect : s => ({ ...s, phase : "finished", value : { kind : "ref", path : id } }),
                    })),
                    pickText("type path", "eg. player.score", (text, s) => ({ ...s, phase : "finished", value : { kind : "ref", path : text } })),
                ];
                return { preview, options, canFinish : false };
            }

            case "call-fn": {
                const options : WizardOption<ExpressionWizardState>[] = [
                    ...EXPR_FUNCTIONS.map((fn) : WizardOption<ExpressionWizardState> => ({
                        kind : "pick", label : fn, onSelect : s => ({ ...s, phase : "call-args", value : { kind : "call", fn, args : [] } }),
                    })),
                    pickText("type function name", "eg. print", (text, s) => ({ ...s, phase : "call-args", value : { kind : "call", fn : text, args : [] } })),
                ];
                return { preview, options, canFinish : false };
            }

            case "call-args": {
                const addArgument = subwizard<ExpressionWizardState, ExpressionWizardState>(
                    "add argument", initialExpressionWizardState(), plan,
                    (child, parent) => parent.value.kind === "call"
                        ? { ...parent, value : { ...parent.value, args : [...parent.value.args, child.value] } }
                        : parent,
                );
                return { preview, options : [addArgument], canFinish : true };
            }

            case "operation-op": {
                const options = BINARY_OPS.map((op) : WizardOption<ExpressionWizardState> => ({
                    kind : "pick", label : op,
                    onSelect : s => ({
                        ...s, phase : "operation-left",
                        value : {
                            kind : "operation", op,
                            left : { kind : "literal", type : "string", value : "" },
                            right : { kind : "literal", type : "string", value : "" },
                        },
                    }),
                }));
                return { preview, options, canFinish : false };
            }

            case "operation-left": {
                const buildLeft = subwizard<ExpressionWizardState, ExpressionWizardState>(
                    "left operand", initialExpressionWizardState(), plan,
                    (child, parent) => parent.value.kind === "operation"
                        ? { phase : "operation-right", value : { ...parent.value, left : child.value } }
                        : parent,
                );
                return { preview, options : [buildLeft], canFinish : false };
            }

            case "operation-right": {
                const buildRight = subwizard<ExpressionWizardState, ExpressionWizardState>(
                    "right operand", initialExpressionWizardState(), plan,
                    (child, parent) => parent.value.kind === "operation"
                        ? { phase : "finished", value : { ...parent.value, right : child.value } }
                        : parent,
                );
                return { preview, options : [buildRight], canFinish : false };
            }

            case "assign-target": {
                const setTarget = (target : string, s : ExpressionWizardState) : ExpressionWizardState => ({
                    ...s, phase : "assign-op", value : { kind : "assign", target, op : "=", value : { kind : "literal", type : "string", value : "" } },
                });
                const options : WizardOption<ExpressionWizardState>[] = [
                    ...context.entityOptions.map((id) : WizardOption<ExpressionWizardState> => ({
                        kind : "pick", label : id, onSelect : s => setTarget(id, s),
                    })),
                    pickText("type target", "eg. player.score", (text, s) => setTarget(text, s)),
                ];
                return { preview, options, canFinish : false };
            }

            case "assign-op": {
                const options = ASSIGN_OPS.map((op) : WizardOption<ExpressionWizardState> => ({
                    kind : "pick", label : op,
                    onSelect : s => ({ ...s, phase : "assign-value", value : s.value.kind === "assign" ? { ...s.value, op } : s.value }),
                }));
                return { preview, options, canFinish : false };
            }

            case "assign-value": {
                const buildValue = subwizard<ExpressionWizardState, ExpressionWizardState>(
                    "value", initialExpressionWizardState(), plan,
                    (child, parent) => parent.value.kind === "assign"
                        ? { phase : "finished", value : { ...parent.value, value : child.value } }
                        : parent,
                );
                return { preview, options : [buildValue], canFinish : false };
            }

            case "raw-text": {
                const options = [pickText("type expression", "eg. move(a).to(b)",
                    (text, s) => ({ ...s, phase : "finished", value : { kind : "raw", text } }))];
                return { preview, options, canFinish : false };
            }

            case "finished":
                return { preview, options : [], canFinish : true };
        }
    };
    return plan;
}
