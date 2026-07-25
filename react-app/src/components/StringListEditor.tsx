import { useState } from "react";

interface StringListEditorProps {
    values : string[];
    onChange : (values : string[]) => void;
    placeholder? : string;
    addLabel? : string;
}

const StringListEditor = ({ values, onChange, placeholder, addLabel } : StringListEditorProps) => {
    const [newValue, setNewValue] = useState<string>("");

    const add = () => {
        const trimmed = newValue.trim();
        if (trimmed && !values.includes(trimmed)) {
            onChange([...values, trimmed]);
            setNewValue("");
        }
    }

    const remove = (value : string) => onChange(values.filter(v => v !== value));

    return (
        <div className="string-list-editor">
            {values.length > 0 && (
                <ul className="exits-list">
                    {values.map(value => (
                        <li key={value} className="exits-list-item">
                            <span>{value}</span>
                            <button type="button" className="word-button" onClick={() => remove(value)} aria-label={`remove ${value}`}>remove</button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="string-list-add">
                <input type="text" value={newValue}
                       placeholder={placeholder}
                       onChange={event => setNewValue(event.target.value)}
                       onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
                <button type="button" className="word-button" onClick={add} disabled={!newValue.trim()}>{addLabel ?? "add"}</button>
            </div>
        </div>
    );
};

export default StringListEditor;
