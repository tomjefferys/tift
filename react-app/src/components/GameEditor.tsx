import { useState } from "react";
import { ValidationError, ValidationResult } from "tift-types/src/messages/output";

interface GameEditorProps {
    gameName : string;
    initialYaml : string;
    onSave : (yamlText : string) => Promise<ValidationResult>;
    onCancel : () => void;
}

function formatError(error : ValidationError) : string {
    const location = [error.file, error.line != null ? `line ${error.line}` : undefined]
                            .filter(part => part)
                            .join(", ");
    return location ? `${location}: ${error.message}` : error.message;
}

const GameEditor = ({ gameName, initialYaml, onSave, onCancel } : GameEditorProps) => {
    const [text, setText] = useState<string>(initialYaml);
    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [saving, setSaving] = useState<boolean>(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await onSave(text);
            setErrors(result.valid ? [] : result.errors);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="game-editor">
            <div className="game-editor-header">
                <span className="game-editor-title">Edit: {gameName}</span>
            </div>
            <textarea
                className="game-editor-textarea"
                value={text}
                onChange={event => setText(event.target.value)}
                spellCheck={false}
                aria-label="game yaml editor"
                disabled={saving}
            />
            {errors.length > 0 && (
                <div className="game-editor-errors" role="alert">
                    {errors.map((error, index) => (
                        <div key={index} className="game-editor-error">{formatError(error)}</div>
                    ))}
                </div>
            )}
            <div className="game-editor-actions">
                <button className="word-button" onClick={handleSave} disabled={saving}>save</button>
                <button className="word-button" onClick={onCancel} disabled={saving}>cancel</button>
            </div>
        </div>
    );
};

export default GameEditor;
