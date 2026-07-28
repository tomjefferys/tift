import { useId } from "react";
import PickerGrid from "./PickerGrid";
import SlotEditor from "./SlotEditor";
import { Matcher, ObjectSlot, matcherArgs, withMatcherArgs } from "../util/actions";

interface MatcherEditorProps {
    matcher : Matcher;
    onChange : (matcher : Matcher) => void;
    verbOptions : string[];
    entityOptions : string[];
}

// Edits a command-pattern matcher - the key side of a before/actions/after
// entry, eg `push(this, $direction)` or `ask(this).about($topic)` (see
// engine/src/script/matchParser.ts). A matcher we couldn't confidently parse
// falls back to a single raw text field.
const MatcherEditor = ({ matcher, onChange, verbOptions, entityOptions } : MatcherEditorProps) => {
    // Unique per instance - before/actions/after can all have a clause open
    // for editing at the same time, so a static id would be duplicated in
    // the DOM and mis-associate each block's <label> with the wrong <input>.
    const id = useId();

    if (matcher.kind === "raw") {
        return (
            <div className="matcher-editor">
                <div className="form-field">
                    <label className="form-label" htmlFor={`${id}-matcher-raw`}>matcher (unrecognised, edited as text)</label>
                    <input id={`${id}-matcher-raw`} type="text" value={matcher.text}
                           onChange={event => onChange({ kind : "raw", text : event.target.value })} />
                </div>
            </div>
        );
    }

    const args = matcherArgs(matcher);
    const setArgs = (args : ObjectSlot[]) => onChange(withMatcherArgs(matcher, args));
    const addArg = () => setArgs([...args, { kind : "this" }]);
    const removeArg = (index : number) => setArgs(args.filter((_, i) => i !== index));
    const updateArg = (index : number, slot : ObjectSlot) => setArgs(args.map((arg, i) => i === index ? slot : arg));

    const attribute = matcher.attribute;
    const addAttribute = () => onChange({ ...matcher, attribute : { name : "", indirectObject : undefined } });
    const removeAttribute = () => onChange({ ...matcher, attribute : undefined });
    const setAttributeName = (name : string) => onChange({ ...matcher, attribute : { ...attribute, name } });
    const setIndirectObject = (indirectObject : ObjectSlot) => onChange({ ...matcher, attribute : attribute && { ...attribute, indirectObject } });
    const removeIndirectObject = () => onChange({ ...matcher, attribute : attribute && { ...attribute, indirectObject : undefined } });

    return (
        <div className="matcher-editor">
            <div className="form-field">
                <label className="form-label" htmlFor={`${id}-matcher-verb`}>verb</label>
                <input id={`${id}-matcher-verb`} type="text" value={matcher.verb} placeholder="eg. push"
                       onChange={event => onChange({ ...matcher, verb : event.target.value })} />
                {verbOptions.length > 0 && (
                    <PickerGrid options={verbOptions} selected={matcher.verb} onSelect={verb => onChange({ ...matcher, verb })} />
                )}
            </div>
            <div className="form-field">
                <div className="form-label">arguments</div>
                {args.length === 0 && (
                    <div className="picker-grid-empty">No arguments (eg an intransitive verb like &quot;look&quot;)</div>
                )}
                {args.length > 0 && (
                    <ul className="matcher-args-list">
                        {args.map((slot, index) => (
                            <li key={index} className="matcher-arg-row">
                                <SlotEditor slot={slot} onChange={s => updateArg(index, s)} entityOptions={entityOptions} />
                                <button type="button" className="word-button" onClick={() => removeArg(index)} aria-label={`remove argument ${index + 1}`}>remove</button>
                            </li>
                        ))}
                    </ul>
                )}
                <button type="button" className="word-button" onClick={addArg}>add argument</button>
            </div>
            <div className="form-field">
                <div className="form-label">attribute (preposition)</div>
                {!attribute ? (
                    <button type="button" className="word-button" onClick={addAttribute}>add attribute</button>
                ) : (
                    <div className="matcher-attribute">
                        <input type="text" value={attribute.name} placeholder="eg. about" aria-label="attribute name"
                               onChange={event => setAttributeName(event.target.value)} />
                        <div className="form-label">indirect object</div>
                        {attribute.indirectObject ? (
                            <div className="matcher-arg-row">
                                <SlotEditor slot={attribute.indirectObject} onChange={setIndirectObject} entityOptions={entityOptions} />
                                <button type="button" className="word-button" onClick={removeIndirectObject}>remove</button>
                            </div>
                        ) : (
                            <button type="button" className="word-button" onClick={() => setIndirectObject({ kind : "this" })}>add indirect object</button>
                        )}
                        <button type="button" className="word-button" onClick={removeAttribute}>remove attribute</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MatcherEditor;
