import PickerGrid from "./PickerGrid";
import { ObjectSlot } from "../util/actions";

const SLOT_KINDS = ["this", "id", "capture"];

interface SlotEditorProps {
    slot : ObjectSlot;
    onChange : (slot : ObjectSlot) => void;
    entityOptions : string[];
}

// Edits a single ObjectSlot - one argument/indirect-object position in a
// command-pattern matcher: "this" (the owning entity), a literal entity id,
// or a "$name" capture that binds a variable for the rule body to use.
const SlotEditor = ({ slot, onChange, entityOptions } : SlotEditorProps) => {
    const setKind = (kind : string) => {
        if (kind === "this") {
            onChange({ kind : "this" });
        } else if (kind === "id") {
            onChange({ kind : "id", id : entityOptions[0] ?? "" });
        } else {
            onChange({ kind : "capture", name : "" });
        }
    };

    return (
        <div className="slot-editor">
            <PickerGrid options={SLOT_KINDS} selected={slot.kind} onSelect={setKind} />
            {slot.kind === "id" && (
                <PickerGrid options={entityOptions} selected={slot.id}
                            onSelect={id => onChange({ kind : "id", id })}
                            emptyMessage="No entities defined yet" />
            )}
            {slot.kind === "capture" && (
                <input type="text" value={slot.name} placeholder="capture name, eg direction"
                       aria-label="capture name"
                       onChange={event => onChange({ kind : "capture", name : event.target.value })} />
            )}
        </div>
    );
};

export default SlotEditor;
