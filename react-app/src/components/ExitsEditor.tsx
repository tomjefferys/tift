import { useState } from "react";
import PickerGrid from "./PickerGrid";
import { DIRECTIONS } from "../util/entitytags";

interface ExitsEditorProps {
    exits : { [direction : string] : string };
    roomOptions : string[];
    onChange : (exits : { [direction : string] : string }) => void;
}

const ExitsEditor = ({ exits, roomOptions, onChange } : ExitsEditorProps) => {
    const [newDirection, setNewDirection] = useState<string | undefined>(undefined);
    const [newDestination, setNewDestination] = useState<string | undefined>(undefined);

    const usedDirections = Object.keys(exits);
    const availableDirections = DIRECTIONS.filter(direction => !usedDirections.includes(direction));

    const removeExit = (direction : string) => {
        const { [direction] : _removed, ...rest } = exits;
        onChange(rest);
    }

    const addExit = () => {
        if (newDirection && newDestination) {
            onChange({ ...exits, [newDirection] : newDestination });
            setNewDirection(undefined);
            setNewDestination(undefined);
        }
    }

    return (
        <div className="exits-editor">
            {usedDirections.length > 0 && (
                <ul className="exits-list">
                    {usedDirections.map(direction => (
                        <li key={direction} className="exits-list-item">
                            <span>{direction} &rarr; {exits[direction]}</span>
                            <button type="button" className="word-button" onClick={() => removeExit(direction)} aria-label={`remove exit ${direction}`}>remove</button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="exits-editor-add">
                <div className="form-label">direction</div>
                <PickerGrid options={availableDirections} selected={newDirection} onSelect={setNewDirection} emptyMessage="No more directions available" />
                <div className="form-label">destination</div>
                <PickerGrid options={roomOptions} selected={newDestination} onSelect={setNewDestination} emptyMessage="No other rooms to link to" />
                <button type="button" className="word-button" onClick={addExit} disabled={!newDirection || !newDestination}>add exit</button>
            </div>
        </div>
    );
};

export default ExitsEditor;
