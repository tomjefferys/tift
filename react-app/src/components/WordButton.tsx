import { WordSelected } from "./Controls";
import { Word } from "tift-types/src/messages/word";

const BackspaceIcon = () => (
    <span style={{ fontSize: '16px' }}>←</span>
);

const ICONS : {[key:string]:React.ReactElement} = { 
    "__BACKSPACE__" : <BackspaceIcon/>
}
interface WordProps {
    word : Word;
    wordSelected : WordSelected;
    disabled? : boolean;
}

const WordButton = ({ word, wordSelected, disabled } : WordProps) => {
    const isIcon = word.type === "control" && ICONS[word.id];
    const className = isIcon ? "word-button word-button--icon" : "word-button";

    return (
        <button 
            className={className}
            onClick={(event) => wordSelected(event, word)}
            disabled={disabled}
            aria-label={isIcon ? "backspace" : word.value}
            data-testid={word.id}
            value={word.id}
        >
            {isIcon ? ICONS[word.id] : word.value}
        </button>
    );
};

export default WordButton;