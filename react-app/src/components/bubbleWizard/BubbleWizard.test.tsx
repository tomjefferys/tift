import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import BubbleWizard, { WizardStep, subwizard } from "./BubbleWizard";

// Suppress the async-state-update act() warnings BubbleGrid's
// requestAnimationFrame-based settle/centering logic causes in jsdom - the
// same known, harmless warning App.test.tsx already suppresses.
const originalError = console.error;
beforeAll(() => {
    console.error = (...args : unknown[]) => {
        if (typeof args[0] === "string" && args[0].includes("Warning: An update to") && args[0].includes("inside a test was not wrapped in act")) {
            return;
        }
        originalError.call(console, ...args);
    };
});
afterAll(() => {
    console.error = originalError;
});

// The live preview and a bubble option can show identical text (eg preview
// "a" and a bubble labelled "a") - scope to the preview element specifically.
function preview() : HTMLElement {
    return document.querySelector(".bubble-wizard-preview") as HTMLElement;
}

// A trivial planner: builds up a string by appending "a" or "b", finishable
// once it has at least one character. Used to exercise the shell's own
// navigation (pick/back/finish/cancel/text/subwizard) without depending on
// either real grammar planner.
function planCount(value : string) : WizardStep<string> {
    return {
        preview : value,
        canFinish : value.length > 0,
        options : [
            { kind : "pick", label : "a", onSelect : v => v + "a" },
            { kind : "pick", label : "b", onSelect : v => v + "b" },
            { kind : "text", label : "type", placeholder : "custom", onSubmit : (text, v) => v + text },
        ],
    };
}

test("picking options advances the preview and finish commits the value", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    const onCancel = vi.fn();
    render(<BubbleWizard title="Test" initial="" planStep={planCount} onFinish={onFinish} onCancel={onCancel} />);

    await act(() => user.click(screen.getByRole("button", { name: "a" })));
    await act(() => user.click(screen.getByRole("button", { name: "b" })));
    expect(preview()).toHaveTextContent("ab");

    await act(() => user.click(screen.getByRole("button", { name: "finish" })));
    expect(onFinish).toHaveBeenCalledWith("ab");
});

test("back undoes the last pick, and finish is hidden until something has been chosen", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<BubbleWizard title="Test" initial="" planStep={planCount} onFinish={onFinish} onCancel={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "finish" })).not.toBeInTheDocument();

    await act(() => user.click(screen.getByRole("button", { name: "a" })));
    expect(preview()).toHaveTextContent("a");

    await act(() => user.click(screen.getByRole("button", { name: "back" })));
    expect(screen.queryByRole("button", { name: "finish" })).not.toBeInTheDocument();
});

test("back at the very first step cancels the whole wizard", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<BubbleWizard title="Test" initial="" planStep={planCount} onFinish={vi.fn()} onCancel={onCancel} />);

    await act(() => user.click(screen.getByRole("button", { name: "back" })));
    expect(onCancel).toHaveBeenCalled();
});

test("a text option swaps the bubble grid for a text prompt and appends the typed text", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<BubbleWizard title="Test" initial="" planStep={planCount} onFinish={onFinish} onCancel={vi.fn()} />);

    await act(() => user.click(screen.getByRole("button", { name: "type" })));
    const input = screen.getByLabelText("wizard text entry");
    await act(() => user.type(input, "xyz"));
    await act(() => user.click(screen.getByRole("button", { name: "confirm" })));

    expect(preview()).toHaveTextContent("xyz");
    await act(() => user.click(screen.getByRole("button", { name: "finish" })));
    expect(onFinish).toHaveBeenCalledWith("xyz");
});

// A planner whose only option enters a nested sub-wizard over the same
// trivial string grammar, joining the child's result back with a "+".
function planWithSub(value : string) : WizardStep<string> {
    return {
        preview : value,
        canFinish : value.length > 0,
        options : [
            subwizard("nested", "", planCount, (childValue : string, parentValue : string) => `${parentValue}[${childValue}]`),
        ],
    };
}

test("a subwizard recurses into a nested frame, and finishing it resolves back into the parent", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<BubbleWizard title="Test" initial="" planStep={planWithSub} onFinish={onFinish} onCancel={vi.fn()} />);

    await act(() => user.click(screen.getByRole("button", { name: "nested" })));
    // Now inside the child frame, using planCount's own bubbles.
    await act(() => user.click(screen.getByRole("button", { name: "a" })));
    await act(() => user.click(screen.getByRole("button", { name: "finish" })));

    // Back in the parent frame, the child's result has been merged in.
    expect(preview()).toHaveTextContent("[a]");
    await act(() => user.click(screen.getByRole("button", { name: "finish" })));
    expect(onFinish).toHaveBeenCalledWith("[a]");
});

test("backing out of a subwizard's very first step abandons it, leaving the parent value untouched", async () => {
    const user = userEvent.setup();
    render(<BubbleWizard title="Test" initial="" planStep={planWithSub} onFinish={vi.fn()} onCancel={vi.fn()} />);

    await act(() => user.click(screen.getByRole("button", { name: "nested" })));
    await act(() => user.click(screen.getByRole("button", { name: "back" })));

    // Back in the parent frame, unchanged (still empty) - "nested" is
    // offered again rather than the finished-child summary.
    expect(screen.getByRole("button", { name: "nested" })).toBeInTheDocument();
});
