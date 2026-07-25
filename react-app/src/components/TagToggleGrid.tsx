interface TagToggleGridProps {
    vocabulary : string[];
    selected : string[];
    onChange : (tags : string[]) => void;
}

const TagToggleGrid = ({ vocabulary, selected, onChange } : TagToggleGridProps) => {
    const toggle = (tag : string) => {
        onChange(selected.includes(tag)
            ? selected.filter(t => t !== tag)
            : [...selected, tag]);
    }

    return (
        <div className="toggle-grid">
            {vocabulary.map(tag => (
                <button
                    key={tag}
                    type="button"
                    className={`word-button toggle-button ${selected.includes(tag) ? 'toggle-button--selected' : ''}`}
                    aria-pressed={selected.includes(tag)}
                    onClick={() => toggle(tag)}
                >
                    {tag}
                </button>
            ))}
        </div>
    );
};

export default TagToggleGrid;
