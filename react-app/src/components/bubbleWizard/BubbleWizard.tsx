import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BubbleOptionsGrid from "./BubbleOptionsGrid";

// A single step in a wizard: the live preview text of the value built so
// far, the bubbles to offer next, and whether "finish" should be offered
// (the value is in a state the caller could stop at).
export interface WizardStep<T> {
    preview : string;
    options : WizardOption<T>[];
    canFinish : boolean;
}

// "pick" - a plain structural choice, immediately producing the next value.
// "text" - the choice requires typing (a literal value, a $capture name, a
// custom function/verb name not in the palette...) - the shell swaps the
// bubble grid for a single text input + confirm, still "one control at a
// time" rather than a form.
// "subwizard" - recurses into a nested wizard over a different value type S
// (eg building one of a call's arguments, itself a full expression). Typed
// as `unknown` at the WizardOption<T> level since TS can't express "some S"
// as an existential; use the `subwizard` helper below to construct one
// type-safely from a call site that does know S.
export type WizardOption<T> =
    | { kind : "pick", label : string, onSelect : (value : T) => T }
    | { kind : "text", label : string, placeholder? : string, onSubmit : (text : string, value : T) => T }
    | { kind : "subwizard", label : string, initial : unknown,
        planStep : (state : unknown) => WizardStep<unknown>,
        onComplete : (state : unknown, value : T) => T };

export function subwizard<T, S>(
    label : string, initial : S,
    planStep : (state : S) => WizardStep<S>,
    onComplete : (state : S, value : T) => T,
) : WizardOption<T> {
    return {
        kind : "subwizard", label,
        initial : initial as unknown,
        planStep : planStep as (state : unknown) => WizardStep<unknown>,
        onComplete : onComplete as (state : unknown, value : T) => T,
    };
}

interface Frame {
    // Stack of values chosen so far in this frame - last entry is current.
    // History (not just the current value) so "back" is free for any
    // planner, mirroring engine/src/command.ts's SentenceNode.previous chain
    // and Controls.tsx's backspace-to-previous-word behaviour.
    history : unknown[];
    planStep : (value : unknown) => WizardStep<unknown>;
    // Called when this frame finishes (with its final value) - either
    // resolves into the parent frame's next value (a subwizard completing),
    // or is the wizard's own onFinish (the root frame).
    onComplete : (value : unknown) => void;
}

interface BubbleWizardProps<T> {
    title : string;
    initial : T;
    planStep : (value : T) => WizardStep<T>;
    onFinish : (value : T) => void;
    onCancel : () => void;
}

// A full-screen, step-at-a-time bubble picker: shows a live preview of the
// value built so far, and a BubbleOptionsGrid of the current step's legal
// next choices - the editor-authoring equivalent of how the game itself
// builds a command one tapped word at a time (engine/src/command.ts +
// Controls.tsx's WordBubbles). Rendered as a fixed, full-viewport overlay
// (`.bubble-wizard-overlay`) regardless of how deeply nested the trigger is
// in the form tree - simpler than lifting overlay state to a shared
// ancestor, and nothing in the editor's own component tree sets a CSS
// property (transform/filter/contain) that would break `position: fixed`.
//
// Two grammars (a MatcherPattern, an ExprValue) drive this same shell via
// their own "planner" functions (matcherWizard.ts/expressionWizard.ts) -
// this component has no opinion about either grammar.
function BubbleWizard<T>({ title, initial, planStep, onFinish, onCancel } : BubbleWizardProps<T>) {
    const [frames, setFrames] = useState<Frame[]>(() => [{
        history : [initial],
        planStep : planStep as (value : unknown) => WizardStep<unknown>,
        onComplete : value => onFinish(value as T),
    }]);
    const [textPrompt, setTextPrompt] = useState<{ placeholder? : string, onSubmit : (text : string, value : unknown) => unknown } | undefined>(undefined);
    const [textValue, setTextValue] = useState<string>("");

    // The overlay is portalled to document.body (below) so it sits outside
    // whatever deeply-nested form triggered it, but that alone only hides
    // the rest of the app *visually* - the underlying form's own buttons
    // would still be in the DOM and reachable by screen readers/keyboard.
    // Mark the app root inert to assistive tech while the wizard is open,
    // same as any other full-screen modal would.
    useEffect(() => {
        const root = document.getElementById("root");
        root?.setAttribute("aria-hidden", "true");
        return () => root?.removeAttribute("aria-hidden");
    }, []);

    const frame = frames[frames.length - 1];
    const value = frame.history[frame.history.length - 1];
    const step = frame.planStep(value);

    const updateFrame = (updater : (frame : Frame) => Frame) => {
        setFrames(current => current.map((f, i) => i === current.length - 1 ? updater(f) : f));
    };

    const advance = (next : unknown) => updateFrame(f => ({ ...f, history : [...f.history, next] }));

    const handlePick = (option : WizardOption<unknown>) => {
        if (option.kind === "pick") {
            advance(option.onSelect(value));
        } else if (option.kind === "text") {
            setTextPrompt({ placeholder : option.placeholder, onSubmit : option.onSubmit });
            setTextValue("");
        } else {
            // Enter a nested frame over the subwizard's own value type -
            // "finish"ing or "back"ing out of it (see goBack/finish below)
            // resolves back into this frame via onComplete.
            const parentIndex = frames.length - 1;
            setFrames(current => [...current, {
                history : [option.initial],
                planStep : option.planStep,
                onComplete : childValue => {
                    setFrames(afterChild => {
                        const parent = afterChild[parentIndex];
                        const parentValue = parent.history[parent.history.length - 1];
                        const resolved = option.onComplete(childValue, parentValue);
                        return afterChild.slice(0, parentIndex).concat([{ ...parent, history : [...parent.history, resolved] }]);
                    });
                },
            }]);
        }
    };

    const confirmText = () => {
        if (textPrompt) {
            advance(textPrompt.onSubmit(textValue, value));
            setTextPrompt(undefined);
        }
    };

    const goBack = () => {
        if (textPrompt) {
            setTextPrompt(undefined);
            return;
        }
        if (frame.history.length > 1) {
            updateFrame(f => ({ ...f, history : f.history.slice(0, -1) }));
        } else if (frames.length > 1) {
            // Abandon this subwizard entirely - the parent's value is left
            // untouched, same as never having entered it.
            setFrames(current => current.slice(0, -1));
        } else {
            onCancel();
        }
    };

    // Popping the finished frame off the stack (for a subwizard) is entirely
    // `onComplete`'s own responsibility (see the closure built in handlePick)
    // - it already replaces the whole frames array in one setFrames call.
    // The root frame's onComplete doesn't touch `frames` at all; the wizard
    // simply stops being rendered once the owning component clears its
    // "wizard open" state in response to onFinish.
    const finish = () => frame.onComplete(value);

    // Portalled to document.body - a sibling of the app root, not a
    // descendant - so marking the root aria-hidden above never hides the
    // wizard itself, regardless of how deeply nested the component that
    // opened it is.
    return createPortal((
        <div className="bubble-wizard-overlay">
            <div className="bubble-wizard-header">
                <div className="game-editor-title">{title}</div>
                <div className="bubble-wizard-preview">{step.preview || " "}</div>
            </div>
            <div className="bubble-wizard-controls">
                <button type="button" className="word-button" onClick={goBack}>back</button>
                <button type="button" className="word-button" onClick={onCancel}>cancel</button>
                {step.canFinish && !textPrompt && (
                    <button type="button" className="word-button" onClick={finish}>finish</button>
                )}
            </div>
            <div className="bubble-wizard-bubbles">
                {textPrompt ? (
                    <div className="bubble-wizard-text-prompt">
                        <input type="text" value={textValue} placeholder={textPrompt.placeholder}
                               aria-label="wizard text entry"
                               onChange={event => setTextValue(event.target.value)} />
                        <button type="button" className="word-button" onClick={confirmText}>confirm</button>
                    </div>
                ) : (
                    <BubbleOptionsGrid labels={step.options.map(option => option.label)}
                                       onSelect={index => handlePick(step.options[index])} />
                )}
            </div>
        </div>
    ), document.body);
}

export default BubbleWizard;
