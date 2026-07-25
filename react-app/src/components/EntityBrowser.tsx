import { useState } from "react";
import EntityForm from "./EntityForm";
import VerbForm from "./VerbForm";
import { ValidationError, ValidationResult } from "tift-types/src/messages/output";
import { GameDoc, parseGameDocuments, serializeGameDocuments } from "../util/gameyaml";
import { RoomFields, ItemFields, VerbFields, listRooms, listItems, listVerbs, listAllEntityIds,
         upsertRoom, upsertItem, upsertVerb, removeEntity } from "../util/entitydocs";

interface EntityBrowserProps {
    gameName : string;
    initialYaml : string;
    onSave : (yamlText : string) => Promise<ValidationResult>;
    onCancel : () => void;
}

type EditTarget = { kind : "room" | "item" | "verb", id? : string };

function formatError(error : ValidationError) : string {
    const location = [error.file, error.line != null ? `line ${error.line}` : undefined]
                            .filter(part => part)
                            .join(", ");
    return location ? `${location}: ${error.message}` : error.message;
}

const EntityBrowser = ({ gameName, initialYaml, onSave, onCancel } : EntityBrowserProps) => {
    const [docs, setDocs] = useState<GameDoc[]>(() => parseGameDocuments(initialYaml));
    const [editing, setEditing] = useState<EditTarget | null>(null);
    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [saving, setSaving] = useState<boolean>(false);

    const rooms = listRooms(docs);
    const items = listItems(docs);
    const verbs = listVerbs(docs);
    const roomIds = rooms.map(room => room.id);

    const handleSaveEntity = (fields : RoomFields | ItemFields) => {
        setDocs(editing?.kind === "room" ? upsertRoom(docs, fields as RoomFields) : upsertItem(docs, fields as ItemFields));
        setEditing(null);
    }

    const handleSaveVerb = (fields : VerbFields) => {
        setDocs(upsertVerb(docs, fields));
        setEditing(null);
    }

    const handleDeleteEntity = () => {
        if (editing) {
            setDocs(removeEntity(docs, editing.kind, editing.id!));
            setEditing(null);
        }
    }

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const result = await onSave(serializeGameDocuments(docs));
            setErrors(result.valid ? [] : result.errors);
        } finally {
            setSaving(false);
        }
    }

    if (editing?.kind === "verb") {
        const existing = editing.id === undefined ? undefined : verbs.find(verb => verb.id === editing.id);
        return (
            <div className="entity-browser">
                <div className="game-editor-header">
                    <span className="game-editor-title">{editing.id ? `Edit verb: ${editing.id}` : "New verb"}</span>
                </div>
                <VerbForm initial={existing}
                          existingIds={verbs.map(verb => verb.id).filter(id => id !== editing.id)}
                          onSave={handleSaveVerb}
                          onCancel={() => setEditing(null)}
                          onDelete={editing.id !== undefined ? handleDeleteEntity : undefined} />
            </div>
        );
    }

    if (editing) {
        const existing = editing.id === undefined
            ? undefined
            : (editing.kind === "room" ? rooms : items).find(entity => entity.id === editing.id);
        return (
            <div className="entity-browser">
                <div className="game-editor-header">
                    <span className="game-editor-title">{editing.id ? `Edit ${editing.kind}: ${editing.id}` : `New ${editing.kind}`}</span>
                </div>
                <EntityForm kind={editing.kind}
                            initial={existing}
                            existingIds={listAllEntityIds(docs).filter(id => id !== editing.id)}
                            roomOptions={roomIds}
                            onSave={handleSaveEntity}
                            onCancel={() => setEditing(null)}
                            onDelete={editing.id !== undefined ? handleDeleteEntity : undefined} />
            </div>
        );
    }

    return (
        <div className="entity-browser">
            <div className="game-editor-header">
                <span className="game-editor-title">Entities: {gameName}</span>
            </div>
            <div className="entity-browser-list">
                <div className="form-label">rooms</div>
                <ul className="entity-list">
                    {rooms.map(room => (
                        <li key={room.id}>
                            <button type="button" className="word-button" onClick={() => setEditing({ kind : "room", id : room.id })}>{room.id}</button>
                        </li>
                    ))}
                </ul>
                <button type="button" className="word-button" onClick={() => setEditing({ kind : "room" })}>add room</button>

                <div className="form-label">items</div>
                <ul className="entity-list">
                    {items.map(item => (
                        <li key={item.id}>
                            <button type="button" className="word-button" onClick={() => setEditing({ kind : "item", id : item.id })}>{item.id}</button>
                        </li>
                    ))}
                </ul>
                <button type="button" className="word-button" onClick={() => setEditing({ kind : "item" })}>add item</button>

                <div className="form-label">verbs</div>
                <ul className="entity-list">
                    {verbs.map(verb => (
                        <li key={verb.id}>
                            <button type="button" className="word-button" onClick={() => setEditing({ kind : "verb", id : verb.id })}>{verb.id}</button>
                        </li>
                    ))}
                </ul>
                <button type="button" className="word-button" onClick={() => setEditing({ kind : "verb" })}>add verb</button>
            </div>
            {errors.length > 0 && (
                <div className="game-editor-errors" role="alert">
                    {errors.map((error, index) => (
                        <div key={index} className="game-editor-error">{formatError(error)}</div>
                    ))}
                </div>
            )}
            <div className="game-editor-actions">
                <button type="button" className="word-button" onClick={handleSaveAll} disabled={saving}>save &amp; close</button>
                <button type="button" className="word-button" onClick={onCancel} disabled={saving}>cancel</button>
            </div>
        </div>
    );
};

export default EntityBrowser;
