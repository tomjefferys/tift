import { useEffect, useId, useRef, useState } from "react";
import PickerGrid from "./PickerGrid";
import {
    ASSIGN_OPS, AssignOp, BINARY_OPS, BinaryOp, EXPR_FUNCTIONS, ExprValue, LiteralType,
    parseExpression, serializeExpression,
} from "../util/expressions";

const MODES = ["output", "literal", "ref", "call", "operation", "assign", "raw"] as const;
type Mode = typeof MODES[number];

function defaultForMode(mode : Mode, current : ExprValue) : ExprValue {
    switch (mode) {
        case "output": return { kind : "output", text : "" };
        case "literal": return { kind : "literal", type : "string", value : "" };
        case "ref": return { kind : "ref", path : "" };
        case "call": return { kind : "call", fn : "print", args : [] };
        case "operation": return { kind : "operation", op : "==", left : { kind : "ref", path : "" }, right : { kind : "ref", path : "" } };
        case "assign": return { kind : "assign", target : "", op : "=", value : { kind : "literal", type : "string", value : "" } };
        case "raw": return { kind : "raw", text : serializeExpression(current) };
    }
}

interface ExpressionEditorProps {
    value : string;
    onChange : (value : string) => void;
    entityOptions : string[];
}

// Edits a single leaf expression string - a "commands" list entry, or a
// conditional's "condition" (see actions.ts's RuleValue). Structures the
// common shapes (function call, reference, literal, binary operation, simple
// assignment, "$" literal output); anything else stays a raw text field -
// see util/expressions.ts for the exact boundary.
//
// Parses `value` into an ExprValue once on mount/prop-change rather than on
// every keystroke (same reasoning as RuleValueEditor's RawRuleEditor - avoids
// fighting the user's typing with a reparse), and emits a freshly serialized
// string on every structural edit.
const ExpressionEditor = ({ value, onChange, entityOptions } : ExpressionEditorProps) => {
    const id = useId();
    const [expr, setExpr] = useState<ExprValue>(() => parseExpression(value));
    // Tracks the last string this instance itself emitted, so an external
    // change to `value` (eg this row's list position now holds a different
    // sibling's data, after another row was removed - React reuses the same
    // component instance under the same index-based key) is detected and
    // reparsed, rather than silently continuing to show stale local state.
    const lastEmitted = useRef(value);

    useEffect(() => {
        if (value !== lastEmitted.current) {
            lastEmitted.current = value;
            setExpr(parseExpression(value));
        }
    }, [value]);

    const update = (next : ExprValue) => {
        const text = serializeExpression(next);
        lastEmitted.current = text;
        setExpr(next);
        onChange(text);
    };

    const setMode = (mode : string) => {
        if (mode !== expr.kind) {
            update(defaultForMode(mode as Mode, expr));
        }
    };

    return (
        <div className="expression-editor">
            <div className="form-field">
                <div className="form-label">expression type</div>
                <PickerGrid options={[...MODES]} selected={expr.kind} onSelect={setMode} />
            </div>

            {expr.kind === "output" && (
                <div className="form-field">
                    <label className="form-label" htmlFor={`${id}-expr-output`}>output text</label>
                    <input id={`${id}-expr-output`} type="text" value={expr.text} placeholder="eg. You see a coin."
                           onChange={event => update({ kind : "output", text : event.target.value })} />
                </div>
            )}

            {expr.kind === "literal" && (
                <div className="form-field">
                    <div className="form-label">literal type</div>
                    <PickerGrid options={["string", "number", "boolean"]} selected={expr.type}
                                onSelect={type => update({ kind : "literal", type : type as LiteralType, value : type === "boolean" ? "true" : "" })} />
                    {expr.type === "boolean" ? (
                        <PickerGrid options={["true", "false"]} selected={expr.value}
                                    onSelect={value => update({ ...expr, value })} />
                    ) : (
                        <input type="text" value={expr.value} aria-label="literal value"
                               placeholder={expr.type === "number" ? "eg. 5" : "eg. You take it"}
                               onChange={event => update({ ...expr, value : event.target.value })} />
                    )}
                </div>
            )}

            {expr.kind === "ref" && (
                <div className="form-field">
                    <div className="form-label">reference</div>
                    <PickerGrid options={["this", ...entityOptions]} selected={expr.path}
                                onSelect={path => update({ kind : "ref", path })}
                                emptyMessage="No entities defined yet" />
                    <input type="text" value={expr.path} aria-label="reference path" placeholder="eg. player.score"
                           onChange={event => update({ kind : "ref", path : event.target.value })} />
                </div>
            )}

            {expr.kind === "call" && (
                <div className="form-field">
                    <label className="form-label" htmlFor={`${id}-expr-fn`}>function</label>
                    <input id={`${id}-expr-fn`} type="text" value={expr.fn} placeholder="eg. print"
                           onChange={event => update({ ...expr, fn : event.target.value })} />
                    <PickerGrid options={EXPR_FUNCTIONS} selected={expr.fn} onSelect={fn => update({ ...expr, fn })} />
                    <div className="form-label">arguments</div>
                    {expr.args.length === 0 && (
                        <div className="picker-grid-empty">No arguments (eg getPlayer())</div>
                    )}
                    {expr.args.length > 0 && (
                        <ul className="expression-args-list">
                            {expr.args.map((arg, index) => (
                                <li key={index} className="expression-arg-row">
                                    <ExpressionEditor value={serializeExpression(arg)} entityOptions={entityOptions}
                                                       onChange={text => update({ ...expr, args : expr.args.map((a, i) => i === index ? parseExpression(text) : a) })} />
                                    <button type="button" className="word-button"
                                            onClick={() => update({ ...expr, args : expr.args.filter((_, i) => i !== index) })}
                                            aria-label={`remove argument ${index + 1}`}>remove</button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <button type="button" className="word-button"
                            onClick={() => update({ ...expr, args : [...expr.args, { kind : "literal", type : "string", value : "" }] })}>add argument</button>
                </div>
            )}

            {expr.kind === "operation" && (
                <div className="expression-editor-nested">
                    <div className="form-field">
                        <div className="form-label">operator</div>
                        <PickerGrid options={[...BINARY_OPS]} selected={expr.op} onSelect={op => update({ ...expr, op : op as BinaryOp })} />
                    </div>
                    <div className="form-field">
                        <div className="form-label">left</div>
                        <ExpressionEditor value={serializeExpression(expr.left)} entityOptions={entityOptions}
                                           onChange={text => update({ ...expr, left : parseExpression(text) })} />
                    </div>
                    <div className="form-field">
                        <div className="form-label">right</div>
                        <ExpressionEditor value={serializeExpression(expr.right)} entityOptions={entityOptions}
                                           onChange={text => update({ ...expr, right : parseExpression(text) })} />
                    </div>
                </div>
            )}

            {expr.kind === "assign" && (
                <div className="expression-editor-nested">
                    <div className="form-field">
                        <label className="form-label" htmlFor={`${id}-expr-target`}>target</label>
                        <input id={`${id}-expr-target`} type="text" value={expr.target} placeholder="eg. player.score"
                               onChange={event => update({ ...expr, target : event.target.value })} />
                    </div>
                    <div className="form-field">
                        <div className="form-label">operator</div>
                        <PickerGrid options={[...ASSIGN_OPS]} selected={expr.op} onSelect={op => update({ ...expr, op : op as AssignOp })} />
                    </div>
                    <div className="form-field">
                        <div className="form-label">value</div>
                        <ExpressionEditor value={serializeExpression(expr.value)} entityOptions={entityOptions}
                                           onChange={text => update({ ...expr, value : parseExpression(text) })} />
                    </div>
                </div>
            )}

            {expr.kind === "raw" && (
                <div className="form-field">
                    <label className="form-label" htmlFor={`${id}-expr-raw`}>raw (unrecognised, edited as text)</label>
                    <input id={`${id}-expr-raw`} type="text" value={expr.text}
                           onChange={event => update({ kind : "raw", text : event.target.value })} />
                </div>
            )}
        </div>
    );
};

export default ExpressionEditor;
