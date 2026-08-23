import { describe, expect, test } from "vitest";
import { initialMatcherWizardState, MatcherWizardState, planMatcherStep } from "./matcherWizard";
import { serializeMatcher } from "./actions";

const context = { verbOptions : ["push", "examine"], entityOptions : ["door", "canteen"] };
const plan = planMatcherStep(context);

function pick(state : MatcherWizardState, label : string) : MatcherWizardState {
    const step = plan(state);
    const option = step.options.find(o => o.label === label);
    if (!option) {
        throw new Error(`No option labelled "${label}" - available: ${step.options.map(o => o.label).join(", ")}`);
    }
    if (option.kind !== "pick") {
        throw new Error(`Option "${label}" is not a pick option`);
    }
    return option.onSelect(state);
}

function type(state : MatcherWizardState, label : string, text : string) : MatcherWizardState {
    const step = plan(state);
    const option = step.options.find(o => o.label === label);
    if (!option || option.kind !== "text") {
        throw new Error(`No text option labelled "${label}"`);
    }
    return option.onSubmit(text, state);
}

describe("matcherWizard", () => {
    test("initial state starts at the verb phase, unable to finish yet", () => {
        const state = initialMatcherWizardState();
        expect(state.phase).toBe("verb");
        const step = plan(state);
        expect(step.canFinish).toBe(false);
        expect(step.options.map(o => o.label)).toEqual(expect.arrayContaining(["push", "examine", "type verb"]));
    });

    test("picking a verb from the palette moves to the args phase", () => {
        const afterVerb = pick(initialMatcherWizardState(), "push");
        expect(afterVerb.phase).toBe("args");
        expect(afterVerb.pattern.verb).toBe("push");
        expect(plan(afterVerb).preview).toBe("push");
    });

    test("typing a custom verb also moves to the args phase", () => {
        const afterVerb = type(initialMatcherWizardState(), "type verb", "unlock");
        expect(afterVerb.phase).toBe("args");
        expect(afterVerb.pattern.verb).toBe("unlock");
    });

    test("a bare verb with no arguments can finish immediately", () => {
        const afterVerb = pick(initialMatcherWizardState(), "examine");
        expect(plan(afterVerb).canFinish).toBe(true);
        expect(serializeMatcher(afterVerb.pattern)).toBe("examine");
    });

    test("picking 'this' then an entity id builds up the argument list, in order", () => {
        let state = pick(initialMatcherWizardState(), "push");
        state = pick(state, "this");
        expect(serializeMatcher(state.pattern)).toBe("push(this)");
        state = pick(state, "door");
        expect(serializeMatcher(state.pattern)).toBe("push(this, door)");
    });

    test("a capture variable is entered as text and prefixed with $ on serialization", () => {
        let state = pick(initialMatcherWizardState(), "push");
        state = type(state, "capture variable", "direction");
        expect(serializeMatcher(state.pattern)).toBe("push($direction)");
    });

    test("adding an attribute: name then indirect object, then the matcher is finished", () => {
        let state = pick(initialMatcherWizardState(), "push");
        state = pick(state, "this");
        state = pick(state, "add attribute");
        expect(state.phase).toBe("attribute-name");

        state = pick(state, "about");
        expect(state.phase).toBe("attribute-object");

        state = pick(state, "door");
        expect(state.phase).toBe("finished");
        expect(serializeMatcher(state.pattern)).toBe("push(this).about(door)");
        expect(plan(state).canFinish).toBe(true);
        expect(plan(state).options).toEqual([]);
    });

    test("choosing 'no indirect object' still finishes with an empty attribute call", () => {
        let state = pick(initialMatcherWizardState(), "push");
        state = pick(state, "add attribute");
        state = type(state, "type attribute name", "around");
        state = pick(state, "no indirect object");
        expect(state.phase).toBe("finished");
        expect(serializeMatcher(state.pattern)).toBe("push.around()");
    });

    test("'add attribute' is only offered once - not offered again after it's been added", () => {
        let state = pick(initialMatcherWizardState(), "push");
        state = pick(state, "add attribute");
        state = pick(state, "about");
        state = pick(state, "door");
        // Back at "args" would no longer make sense to re-offer "add
        // attribute" - but we're at "finished" already in this flow, so
        // instead verify directly on a state that has an attribute but is
        // still (hypothetically) in the args phase.
        const withAttribute : MatcherWizardState = { phase : "args", pattern : { ...state.pattern } };
        expect(plan(withAttribute).options.some(o => o.label === "add attribute")).toBe(false);
    });

    test("resuming the wizard on an existing pattern starts at the args phase", () => {
        const resumed = initialMatcherWizardState({ kind : "pattern", verb : "get", modifiers : [], directObject : { kind : "this" } });
        expect(resumed.phase).toBe("args");
        expect(plan(resumed).preview).toBe("get(this)");
    });
});
