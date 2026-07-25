interface PickerGridProps {
    options : string[];
    selected? : string;
    onSelect : (value : string) => void;
    emptyMessage? : string;
}

const PickerGrid = ({ options, selected, onSelect, emptyMessage } : PickerGridProps) => {
    if (options.length === 0) {
        return <div className="picker-grid-empty">{emptyMessage ?? "Nothing to pick"}</div>;
    }
    return (
        <div className="toggle-grid">
            {options.map(option => (
                <button
                    key={option}
                    type="button"
                    className={`word-button toggle-button ${selected === option ? 'toggle-button--selected' : ''}`}
                    aria-pressed={selected === option}
                    onClick={() => onSelect(option)}
                >
                    {option}
                </button>
            ))}
        </div>
    );
};

export default PickerGrid;
