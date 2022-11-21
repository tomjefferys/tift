import React from "react";
import "./Controls.css";
import { IdValue } from "tift-engine/src/shared";

interface ControlProps {
    words : IdValue<string>[];
    wordSelected : (event : React.MouseEvent<HTMLButtonElement>, word : IdValue<string>) => void;
}

interface WordProps {
    word : IdValue<string>;
    wordSelected : (event : React.MouseEvent<HTMLButtonElement>, word : IdValue<string>) => void;
}

const Controls = ({ words, wordSelected } : ControlProps) => (
    <div className="buttonContainer">
        {words.map(word => <WordButton key={word.id} word={word} wordSelected={wordSelected}/>)}
    </div>
);

const WordButton = ({ word, wordSelected } : WordProps) => (
    <div className="buttonCell">
        <button className="wordButton" 
                value={word.id} 
                onClick={(event) => wordSelected(event, word)}>{word.value}</button>
    </div>
)

export default Controls;