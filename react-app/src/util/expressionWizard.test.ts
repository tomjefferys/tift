import { describe, expect, test } from "vitest";
import { ExpressionWizardState, initialExpressionWizardState, planExpressionStep } from "./expressionWizard";
import { WizardOption } from "../components/bubbleWizard/BubbleWizard";
import { serializeExpression } from "./expressions";

const context = { entityOptions : ["door", "coin"] };
const plan = planExpressionStep(context);

function findOption(state : ExpressionWizardState, label : string) : WizardOption<ExpressionWizardState> {
    const step = plan(state);
    const option = step.options.find(o => o.label === label);
    if (!option) {
        throw new Error(`No option labelled "${label}" - available: ${step.options.map(o => o.label).join(", ")}`);
    }
    return option;
}

function pick(state : ExpressionWizardState, label : string) : ExpressionWizardState {
    const option = findOption(state, label);
    if (option.kind !== "pick") {
        throw new Error(`Option "${label}" is not a pick option`);
    }
    return option.onSelect(state);
}

function type(state : ExpressionWizardState, label : string, text : string) : ExpressionWizardState {
    const option = findOption(state, label);
    if (option.kind !== "text") {
        throw new Error(`Option "${label}" is not a text option`);
    }
    return option.onSubmit(text, state);
}

// Drives a "subwizard" option fully (its own pick/type sequence), returning
// the PARENT state that results once the child finishes - mirrors what
// BubbleWizard itself does when the shell's "finish" button is pressed
// inside a nested frame.
function runSubwizard(
    parent : ExpressionWizardState, label : string,
    build : (childInitial : ExpressionWizardState) => ExpressionWizardState,
) : ExpressionWizardState {
    const option = findOption(parent, label);
    if (option.kind !== "subwizard") {
        throw new Error(`Option "${label}" is not a subwizard option`);
    }
    const childInitial = option.initial as ExpressionWizardState;
    const finishedChild = build(childInitial);
    return option.onComplete(finishedChild, parent) as ExpressionWizardState;
}

describe("expressionWizard", () => {
    test("initial state starts at the kind phase, unable to finish yet", () => {
        const state = initialExpressionWizardState();
        expect(state.phase).toBe("kind");
        const step = plan(state);
        expect(step.canFinish).toBe(false);
        expect(step.options.map(o => o.label)).toEqual(["output", "literal", "ref", "call", "operation", "assign", "raw"]);
    });

    test("building a call with one string-literal argument, eg print('You take it')", () => {
        let state = pick(initialExpressionWizardState(), "call");
        state = pick(state, "print");
        expect(state.phase).toBe("call-args");
        expect(plan(state).canFinish).toBe(true);

        state = runSubwizard(state, "add argument", childInitial => {
            let child = pick(childInitial, "literal");
            child = pick(child, "string");
            child = type(child, "type value", "You take it");
            expect(child.phase).toBe("finished");
            return child;
        });

        expect(serializeExpression(state.value)).toBe("print('You take it')");
    });

    test("a bare call with no arguments can finish immediately, eg getPlayer()", () => {
        let state = pick(initialExpressionWizardState(), "call");
        state = pick(state, "getPlayer");
        expect(plan(state).canFinish).toBe(true);
        expect(serializeExpression(state.value)).toBe("getPlayer()");
    });

    test("a ref can be an entity id or a typed dotted path", () => {
        let state = pick(initialExpressionWizardState(), "ref");
        state = pick(state, "door");
        expect(serializeExpression(state.value)).toBe("door");

        let pathState = pick(initialExpressionWizardState(), "ref");
        pathState = type(pathState, "type path", "player.score");
        expect(serializeExpression(pathState.value)).toBe("player.score");
    });

    test("output text is prefixed with $ on serialization", () => {
        let state = pick(initialExpressionWizardState(), "output");
        state = type(state, "type output text", "You see a coin.");
        expect(serializeExpression(state.value)).toBe("$You see a coin.");
    });

    test("a boolean literal is picked, not typed", () => {
        let state = pick(initialExpressionWizardState(), "literal");
        state = pick(state, "boolean");
        expect(state.phase).toBe("finished");
        state = pick({ ...state, phase : "literal-value" }, "false");
        expect(serializeExpression(state.value)).toBe("false");
    });

    test("building a comparison operation recurses into left and right operand subwizards", () => {
        let state = pick(initialExpressionWizardState(), "operation");
        state = pick(state, "==");
        expect(state.phase).toBe("operation-left");

        state = runSubwizard(state, "left operand", childInitial => {
            let child = pick(childInitial, "ref");
            child = pick(child, "door");
            return child;
        });
        expect(state.phase).toBe("operation-right");

        state = runSubwizard(state, "right operand", childInitial => {
            let child = pick(childInitial, "ref");
            child = pick(child, "coin");
            return child;
        });

        expect(state.phase).toBe("finished");
        expect(serializeExpression(state.value)).toBe("door == coin");
    });

    test("building an assignment: target, operator, then a value subwizard", () => {
        let state = pick(initialExpressionWizardState(), "assign");
        state = type(state, "type target", "player.score");
        state = pick(state, "+=");
        expect(state.phase).toBe("assign-value");

        state = runSubwizard(state, "value", childInitial => {
            let child = pick(childInitial, "literal");
            child = pick(child, "number");
            child = type(child, "type value", "1");
            return child;
        });

        expect(serializeExpression(state.value)).toBe("player.score += 1");
    });

    test("raw text is offered as an escape hatch and preserved verbatim", () => {
        let state = pick(initialExpressionWizardState(), "raw");
        state = type(state, "type expression", "move(a).to(b)");
        expect(serializeExpression(state.value)).toBe("move(a).to(b)");
    });

    test("resuming on an existing call resumes at call-args, ready to add another argument", () => {
        const resumed = initialExpressionWizardState({ kind : "call", fn : "setTag", args : [{ kind : "ref", path : "door" }] });
        expect(resumed.phase).toBe("call-args");
        expect(plan(resumed).preview).toBe("setTag(door)");
    });

    test("resuming on a non-call value resumes at finished", () => {
        const resumed = initialExpressionWizardState({ kind : "ref", path : "this" });
        expect(resumed.phase).toBe("finished");
        expect(plan(resumed).canFinish).toBe(true);
    });

    test("resuming on an empty raw value (a freshly added, not-yet-written command) starts at the kind picker", () => {
        const resumed = initialExpressionWizardState({ kind : "raw", text : "" });
        expect(resumed.phase).toBe("kind");
        expect(plan(resumed).canFinish).toBe(false);
    });

    test("resuming on a non-empty raw value resumes at finished, not the kind picker", () => {
        const resumed = initialExpressionWizardState({ kind : "raw", text : "move(a).to(b)" });
        expect(resumed.phase).toBe("finished");
        expect(plan(resumed).canFinish).toBe(true);
    });
});
