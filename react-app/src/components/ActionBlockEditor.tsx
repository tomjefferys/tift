import { useState } from "react";
import MatcherEditor from "./MatcherEditor";
import RuleValueEditor from "./RuleValueEditor";
import { ActionClause, serializeMatcher } from "../util/actions";

interface ActionBlockEditorProps {
    title : string;
    clauses : ActionClause[];
    onChange : (clauses : ActionClause[]) => void;
    verbOptions : string[];
    entityOptions : string[];
}

function newClause() : ActionClause {
    return {
        matcher : { kind : "pattern", verb : "", directObject : undefined, modifiers : [], attribute : undefined },
        rule : { kind : "commands", commands : [] },
    };
}

// A collapsible before/actions/after block: a list of matcher -> rule
// clauses, each tap-editable via MatcherEditor + RuleValueEditor. Shared by
// VerbForm (before/actions/after) and EntityForm (before/after on rooms and
// items) since all three fields use identical machinery in the engine.
const ActionBlockEditor = ({ title, clauses, onChange, verbOptions, entityOptions } : ActionBlockEditorProps) => {
    const [collapsed, setCollapsed] = useState<boolean>(clauses.length === 0);
    const [editingIndex, setEditingIndex] = useState<number | undefined>(undefined);

    const matcherKeys = clauses.map(clause => serializeMatcher(clause.matcher));
    const duplicateKeys = Array.from(new Set(
        matcherKeys.filter((key, index) => key !== "" && matcherKeys.indexOf(key) !== index)
    ));

    const addClause = () => {
        onChange([...clauses, newClause()]);
        setEditingIndex(clauses.length);
        setCollapsed(false);
    };
    const updateClause = (index : number, clause : ActionClause) => onChange(clauses.map((existing, i) => i === index ? clause : existing));
    const removeClause = (index : number) => {
        onChange(clauses.filter((_, i) => i !== index));
        setEditingIndex(undefined);
    };

    return (
        <div className="action-block-editor">
            <button type="button" className="action-block-toggle" onClick={() => setCollapsed(!collapsed)}
                    aria-expanded={!collapsed}>
                <span className="form-label">{title} ({clauses.length})</span>
                <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
            </button>
            {!collapsed && (
                <div className="action-block-body">
                    {duplicateKeys.length > 0 && (
                        <div className="form-error" role="alert">
                            Duplicate {title} matcher{duplicateKeys.length > 1 ? "s" : ""}: {duplicateKeys.join(", ")}
                        </div>
                    )}
                    <ul className="action-clause-list">
                        {clauses.map((clause, index) => (
                            <li key={index} className="action-clause-item">
                                {editingIndex === index ? (
                                    <div className="action-clause-editor">
                                        <MatcherEditor matcher={clause.matcher}
                                                       onChange={matcher => updateClause(index, { ...clause, matcher })}
                                                       verbOptions={verbOptions} entityOptions={entityOptions} />
                                        <RuleValueEditor value={clause.rule} onChange={rule => updateClause(index, { ...clause, rule })} />
                                        <div className="entity-form-actions">
                                            <button type="button" className="word-button" onClick={() => setEditingIndex(undefined)}>done</button>
                                            <button type="button" className="word-button" onClick={() => removeClause(index)}>delete</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button type="button" className="word-button" onClick={() => setEditingIndex(index)}>
                                        {serializeMatcher(clause.matcher) || "(empty matcher)"}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                    <button type="button" className="word-button" onClick={addClause}>add {title} clause</button>
                </div>
            )}
        </div>
    );
};

export default ActionBlockEditor;
