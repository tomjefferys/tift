import { useId, useState } from "react";
import PickerGrid from "./PickerGrid";
import ExpressionEditor from "./ExpressionEditor";
import { RuleValue, serializeRuleValue } from "../util/actions";

// The rule control-clause vocabulary this editor structures (see
// engine/src/game/rulebuilder.ts): when/if/unless (condition), do/switch/
// repeat/random/once (action - "all"/"then" are accepted synonyms for "do"
// on read but always written back as "do"), otherwise/else (canonicalised to
// "otherwise"). Leaf expression strings (the individual commands themselves)
// stay free text - tap-composing those is a later milestone.
const MODES = ["commands", "conditional", "switch", "repeat", "random", "once", "raw"] as const;
type Mode = typeof MODES[number];

function defaultForMode(mode : Mode, current : RuleValue) : RuleValue {
    switch (mode) {
        case "commands": return { kind : "commands", commands : [] };
        case "conditional": return { kind : "conditional", condType : "when", condition : "", action : { kind : "commands", commands : [] } };
        case "switch": return { kind : "switch", cases : [] };
        case "repeat": return { kind : "repeat", steps : [] };
        case "random": return { kind : "random", choices : [] };
        case "once": return { kind : "once", action : { kind : "commands", commands : [] } };
        case "raw": return { kind : "raw", value : serializeRuleValue(current) };
    }
}

interface RuleValueListEditorProps {
    items : RuleValue[];
    onChange : (items : RuleValue[]) => void;
    entityOptions : string[];
}

// A list of nested rules, used for switch/repeat/random's case lists.
const RuleValueListEditor = ({ items, onChange, entityOptions } : RuleValueListEditorProps) => {
    const addItem = () => onChange([...items, { kind : "commands", commands : [] }]);
    const removeItem = (index : number) => onChange(items.filter((_, i) => i !== index));
    const updateItem = (index : number, item : RuleValue) => onChange(items.map((existing, i) => i === index ? item : existing));

    return (
        <div className="rule-value-list">
            {items.map((item, index) => (
                <div key={index} className="rule-value-list-item">
                    <RuleValueEditor value={item} onChange={updated => updateItem(index, updated)} entityOptions={entityOptions} />
                    <button type="button" className="word-button" onClick={() => removeItem(index)} aria-label={`remove item ${index + 1}`}>remove</button>
                </div>
            ))}
            <button type="button" className="word-button" onClick={addItem}>add item</button>
        </div>
    );
};

interface ExpressionListEditorProps {
    commands : string[];
    onChange : (commands : string[]) => void;
    entityOptions : string[];
}

// The list of expression strings run in order for a "commands" RuleValue -
// each one tap-composable via ExpressionEditor rather than typed as plain
// text (see util/expressions.ts).
const ExpressionListEditor = ({ commands, onChange, entityOptions } : ExpressionListEditorProps) => {
    const addCommand = () => onChange([...commands, ""]);
    const removeCommand = (index : number) => onChange(commands.filter((_, i) => i !== index));
    const updateCommand = (index : number, command : string) => onChange(commands.map((existing, i) => i === index ? command : existing));

    return (
        <div className="rule-value-list">
            {commands.map((command, index) => (
                <div key={index} className="rule-value-list-item">
                    <ExpressionEditor value={command} onChange={updated => updateCommand(index, updated)} entityOptions={entityOptions} />
                    <button type="button" className="word-button" onClick={() => removeCommand(index)} aria-label={`remove command ${index + 1}`}>remove</button>
                </div>
            ))}
            <button type="button" className="word-button" onClick={addCommand}>add command</button>
        </div>
    );
};

interface RawRuleEditorProps {
    value : unknown;
    onChange : (value : unknown) => void;
}

// Edits an unrecognised RuleValue's underlying data as JSON. Fully controlled
// (not defaultValue/onBlur) so every keystroke is kept locally and nothing is
// silently lost: valid JSON is propagated to the parent immediately, invalid
// (eg still-incomplete) JSON is kept in the text box with an inline error
// rather than being discarded. Remounts fresh (via the conditional render in
// RuleValueEditor below) each time the user re-enters raw mode.
const RawRuleEditor = ({ value, onChange } : RawRuleEditorProps) => {
    const id = useId();
    const [text, setText] = useState<string>(() => JSON.stringify(value, null, 2));
    const [error, setError] = useState<string>("");

    const handleChange = (newText : string) => {
        setText(newText);
        try {
            onChange(JSON.parse(newText));
            setError("");
        } catch {
            setError("Not valid JSON yet - your edit is kept here until it parses");
        }
    };

    return (
        <div className="form-field">
            <label className="form-label" htmlFor={`${id}-rule-raw`}>raw (unrecognised, edited as JSON)</label>
            <textarea id={`${id}-rule-raw`} value={text} onChange={event => handleChange(event.target.value)} />
            {error && <div className="form-error" role="alert">{error}</div>}
        </div>
    );
};

interface RuleValueEditorProps {
    value : RuleValue;
    onChange : (value : RuleValue) => void;
    entityOptions : string[];
}

// Recursively edits a RuleValue - the value side of a before/actions/after
// entry, or of any nested condition/switch/repeat/random/once clause.
const RuleValueEditor = ({ value, onChange, entityOptions } : RuleValueEditorProps) => {
    const setMode = (mode : string) => {
        if (mode !== value.kind) {
            onChange(defaultForMode(mode as Mode, value));
        }
    };

    return (
        <div className="rule-value-editor">
            <div className="form-field">
                <div className="form-label">rule type</div>
                <PickerGrid options={[...MODES]} selected={value.kind} onSelect={setMode} />
            </div>

            {value.kind === "commands" && (
                <div className="form-field">
                    <div className="form-label">commands (expressions, run in order)</div>
                    <ExpressionListEditor commands={value.commands}
                                          onChange={commands => onChange({ kind : "commands", commands })}
                                          entityOptions={entityOptions} />
                </div>
            )}

            {value.kind === "conditional" && (
                <div className="rule-value-nested">
                    <div className="form-field">
                        <div className="form-label">condition type</div>
                        <PickerGrid options={["when", "if", "unless"]} selected={value.condType}
                                    onSelect={condType => onChange({ ...value, condType : condType as "when" | "if" | "unless" })} />
                    </div>
                    <div className="form-field">
                        <div className="form-label">condition (expression)</div>
                        <ExpressionEditor value={value.condition} entityOptions={entityOptions}
                                          onChange={condition => onChange({ ...value, condition })} />
                    </div>
                    <div className="form-field">
                        <div className="form-label">then</div>
                        <RuleValueEditor value={value.action} onChange={action => onChange({ ...value, action })} entityOptions={entityOptions} />
                    </div>
                    <div className="form-field">
                        <div className="form-label">otherwise</div>
                        {value.otherwise ? (
                            <>
                                <RuleValueEditor value={value.otherwise} onChange={otherwise => onChange({ ...value, otherwise })} entityOptions={entityOptions} />
                                <button type="button" className="word-button" onClick={() => onChange({ ...value, otherwise : undefined })}>remove otherwise</button>
                            </>
                        ) : (
                            <button type="button" className="word-button"
                                    onClick={() => onChange({ ...value, otherwise : { kind : "commands", commands : [] } })}>add otherwise</button>
                        )}
                    </div>
                </div>
            )}

            {value.kind === "switch" && (
                <div className="form-field">
                    <div className="form-label">cases (first truthy one runs)</div>
                    <RuleValueListEditor items={value.cases} onChange={cases => onChange({ ...value, cases })} entityOptions={entityOptions} />
                </div>
            )}

            {value.kind === "repeat" && (
                <div className="form-field">
                    <div className="form-label">steps (one runs per turn, cycling)</div>
                    <RuleValueListEditor items={value.steps} onChange={steps => onChange({ ...value, steps })} entityOptions={entityOptions} />
                </div>
            )}

            {value.kind === "random" && (
                <div className="form-field">
                    <div className="form-label">choices (one runs at random)</div>
                    <RuleValueListEditor items={value.choices} onChange={choices => onChange({ ...value, choices })} entityOptions={entityOptions} />
                </div>
            )}

            {value.kind === "once" && (
                <div className="form-field">
                    <div className="form-label">action (runs only the first time)</div>
                    <RuleValueEditor value={value.action} onChange={action => onChange({ ...value, action })} entityOptions={entityOptions} />
                </div>
            )}

            {value.kind === "raw" && (
                <RawRuleEditor value={value.value} onChange={rawValue => onChange({ kind : "raw", value : rawValue })} />
            )}
        </div>
    );
};

export default RuleValueEditor;
