import { useState } from "react";
import TagToggleGrid from "./TagToggleGrid";
import PickerGrid from "./PickerGrid";
import ExitsEditor from "./ExitsEditor";
import ActionBlockEditor from "./ActionBlockEditor";
import { RoomFields, ItemFields } from "../util/entitydocs";
import { ActionClause } from "../util/actions";
import { ROOM_TAGS, ITEM_TAGS } from "../util/entitytags";

const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

type EntityFields = RoomFields | ItemFields;

interface EntityFormProps {
    kind : "room" | "item";
    initial? : EntityFields;
    existingIds : string[];
    roomOptions : string[];
    verbOptions : string[];
    entityOptions : string[];
    onSave : (fields : EntityFields) => void;
    onCancel : () => void;
    onDelete? : () => void;
}

const EntityForm = ({ kind, initial, existingIds, roomOptions, verbOptions, entityOptions, onSave, onCancel, onDelete } : EntityFormProps) => {
    const isNew = initial === undefined;
    const [id, setId] = useState<string>(initial?.id ?? "");
    const [name, setName] = useState<string>(initial?.name ?? "");
    const [description, setDescription] = useState<string>(initial?.description ?? "");
    const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
    const [exits, setExits] = useState<{ [direction : string] : string }>(
        kind === "room" ? (initial as RoomFields | undefined)?.exits ?? {} : {});
    const [location, setLocation] = useState<string>(
        kind === "item" ? (initial as ItemFields | undefined)?.location ?? "" : "");
    const [before, setBefore] = useState<ActionClause[]>(initial?.before ?? []);
    const [after, setAfter] = useState<ActionClause[]>(initial?.after ?? []);
    const [idError, setIdError] = useState<string>("");

    const otherRoomOptions = roomOptions.filter(roomId => roomId !== id);

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
        const fields = { id, name, description, tags, before, after,
                          ...(kind === "room" ? { exits } : { location }) } as EntityFields;
        onSave(fields);
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
                <label className="form-label" htmlFor="entity-description">description</label>
                <textarea id="entity-description" value={description} onChange={event => setDescription(event.target.value)} />
            </div>
            <div className="form-field">
                <div className="form-label">tags</div>
                <TagToggleGrid vocabulary={kind === "room" ? ROOM_TAGS : ITEM_TAGS} selected={tags} onChange={setTags} />
            </div>
            {kind === "room" ? (
                <div className="form-field">
                    <div className="form-label">exits</div>
                    <ExitsEditor exits={exits} roomOptions={otherRoomOptions} onChange={setExits} />
                </div>
            ) : (
                <div className="form-field">
                    <div className="form-label">location</div>
                    <PickerGrid options={roomOptions} selected={location} onSelect={setLocation} emptyMessage="Add a room first" />
                </div>
            )}
            <ActionBlockEditor title="before" clauses={before} onChange={setBefore} verbOptions={verbOptions} entityOptions={entityOptions} />
            <ActionBlockEditor title="after" clauses={after} onChange={setAfter} verbOptions={verbOptions} entityOptions={entityOptions} />
            <div className="entity-form-actions">
                <button type="button" className="word-button" onClick={handleSave}>save</button>
                <button type="button" className="word-button" onClick={onCancel}>cancel</button>
                {onDelete && <button type="button" className="word-button" onClick={onDelete}>delete</button>}
            </div>
        </div>
    );
};

export default EntityForm;
