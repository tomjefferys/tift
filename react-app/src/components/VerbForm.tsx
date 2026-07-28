import { useState } from "react";
import TagToggleGrid from "./TagToggleGrid";
import PickerGrid from "./PickerGrid";
import StringListEditor from "./StringListEditor";
import ActionBlockEditor from "./ActionBlockEditor";
import { VerbFields } from "../util/entitydocs";
import { ActionClause } from "../util/actions";
import { VERB_CONTEXTS, VERB_TRANSITIVITY } from "../util/entitytags";

const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

interface VerbFormProps {
    initial? : VerbFields;
    existingIds : string[];
    verbOptions : string[];
    entityOptions : string[];
    onSave : (fields : VerbFields) => void;
    onCancel : () => void;
    onDelete? : () => void;
}

const VerbForm = ({ initial, existingIds, verbOptions, entityOptions, onSave, onCancel, onDelete } : VerbFormProps) => {
    const isNew = initial === undefined;
    const [id, setId] = useState<string>(initial?.id ?? "");
    const [name, setName] = useState<string>(initial?.name ?? "");
    const [transitivity, setTransitivity] = useState<"transitive" | "intransitive">(initial?.transitivity ?? "transitive");
    const [attributes, setAttributes] = useState<string[]>(initial?.attributes ?? []);
    const [modifiers, setModifiers] = useState<string[]>(initial?.modifiers ?? []);
    const [contexts, setContexts] = useState<string[]>(initial?.contexts ?? []);
    const [before, setBefore] = useState<ActionClause[]>(initial?.before ?? []);
    const [actions, setActions] = useState<ActionClause[]>(initial?.actions ?? []);
    const [after, setAfter] = useState<ActionClause[]>(initial?.after ?? []);
    const [idError, setIdError] = useState<string>("");

    const handleSave = () => {
        if (isNew) {
            if (!ID_PATTERN.test(id)) {
                setIdError("Id must start with a letter, and contain only letters, numbers and underscores");
                return;
            }
            if (existingIds.includes(id)) {
                setIdError("Id is already in use");
                return;
            }
        }
        onSave({ id, name, transitivity, attributes, modifiers, contexts, before, actions, after });
    }

    return (
        <div className="entity-form">
            <div className="form-field">
                <label className="form-label" htmlFor="entity-id">id</label>
                <input id="entity-id" type="text" value={id}
                       disabled={!isNew}
                       onChange={event => setId(event.target.value)} />
                {idError && <div className="form-error" role="alert">{idError}</div>}
            </div>
            <div className="form-field">
                <label className="form-label" htmlFor="entity-name">name</label>
                <input id="entity-name" type="text" value={name} onChange={event => setName(event.target.value)} />
            </div>
            <div className="form-field">
                <div className="form-label">transitivity</div>
                <PickerGrid options={VERB_TRANSITIVITY} selected={transitivity}
                            onSelect={value => setTransitivity(value as "transitive" | "intransitive")} />
            </div>
            <div className="form-field">
                <div className="form-label">attributes (prepositions)</div>
                <StringListEditor values={attributes} onChange={setAttributes} placeholder="eg. with" />
            </div>
            <div className="form-field">
                <div className="form-label">modifiers</div>
                <StringListEditor values={modifiers} onChange={setModifiers} placeholder="eg. turn_direction" />
            </div>
            <div className="form-field">
                <div className="form-label">contexts</div>
                <TagToggleGrid vocabulary={VERB_CONTEXTS} selected={contexts} onChange={setContexts} />
            </div>
            <ActionBlockEditor title="before" clauses={before} onChange={setBefore} verbOptions={verbOptions} entityOptions={entityOptions} />
            <ActionBlockEditor title="actions" clauses={actions} onChange={setActions} verbOptions={verbOptions} entityOptions={entityOptions} />
            <ActionBlockEditor title="after" clauses={after} onChange={setAfter} verbOptions={verbOptions} entityOptions={entityOptions} />
            <div className="entity-form-actions">
                <button type="button" className="word-button" onClick={handleSave}>save</button>
                <button type="button" className="word-button" onClick={onCancel}>cancel</button>
                {onDelete && <button type="button" className="word-button" onClick={onDelete}>delete</button>}
            </div>
        </div>
    );
};

export default VerbForm;
