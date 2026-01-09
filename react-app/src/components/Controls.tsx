import React, { useState, useEffect } from "react";
import { PartOfSpeech, Word } from "tift-types/src/messages/word";
import { WordType } from "tift-types/src/messages/output";
import WordButton from "./WordButton";

import { Axial, HexMap } from "../util/hex";
import * as BubbleGrid from "./bubbleGrid/BubbleGrid";
import { BACKSPACE } from "../util/util";

export type WordSelected = (event : React.MouseEvent<HTMLButtonElement>, word : Word) => void;

interface GridCell {
    wordId : string;
    columns : number;
    defaultValue? : string;
}

const cell = (wordId : string, columns = 1, defaultValue? : string) : GridCell => ({ wordId, columns, defaultValue });

interface ControlProps {
    words : Word[];
    wordSelected : WordSelected;
    panelIds : string[];
    useBubbles: boolean;
}

type WordFilter = (words:Word[]) => Word[];

interface WordButtonsProps {
    wordFilter: WordFilter,
    allWords : Word[],
    wordSelected : WordSelected;
}

interface PanelDefinition {
    id : string;
    name : string;
    wordFilter : WordFilter;
}

interface SimpleButtonGridProps {
    words : Word[];
    columns : number;
    wordSelected : WordSelected; 
}

interface CustomButtonGridProps {
    words : Word[];
    totalColumns : number;
    cells : GridCell[];
    wordSelected : WordSelected; 
}

const PANELS : PanelDefinition[] = 
                [{
                    id : "game",
                    name : "Game",
                    wordFilter : words => filterWords(words, ["word", "control"])
                                            .filter(word => !word.tags?.includes("debug"))
                 },
                 {
                    id : "inventory",
                    name : "Inventory",
                    wordFilter : words => filterWords(words, ["word"])
                                            .filter(word => word.tags?.includes("inventory"))
                 },
                 {
                    id : "developer",
                    name : "Developer",
                    wordFilter : words => filterWords(words, ["word", "control"])
                                            .filter(word => word.tags?.includes("debug"))
                 },
                 {
                    id : "options", name : "Options",
                    wordFilter : words => filterWords(words, ["option", "select"])
                }];

const Controls = ({ words, wordSelected, panelIds, useBubbles } : ControlProps) => {

    const [tabIndex, setTabIndex] = useState(0);

    const handleTabsChange = (index : number) => setTabIndex(index);

    const activePanels = panelIds.map(id => {
        const panel = PANELS.find(panel => panel.id === id);
        if (!panel) {
            throw new Error(`Invalid panel ID: ${id}`);
        }
        return panel;
    });

    // Reset the tabs if the words change
    useEffect(() => {
        const wordCounts = activePanels.map(panel => panel.wordFilter(words).length)
        const firstNonOptionsPanelWithContent = wordCounts.findIndex((count, index) => 
                count > 0 && activePanels[index].id !== "options");
        if (firstNonOptionsPanelWithContent >= 0) {
            setTabIndex(firstNonOptionsPanelWithContent);
        } else {
            const firstPanelWithContent = wordCounts.findIndex(count => count > 0);
            if (firstPanelWithContent >= 0) {
                setTabIndex(firstPanelWithContent);
            }
        }
    }, [words]);

    return (
        <div className="controls-container">
            <div className="tabs">
                <div className="tab-list">
                    {activePanels.map((panel, index) => (
                        <button 
                            key={panel.id}
                            className={`tab ${index === tabIndex ? 'tab--active' : ''}`}
                            onClick={() => handleTabsChange(index)}
                        >
                            {panel.name}
                        </button>
                    ))}
                </div>
                <div className="tab-panels">
                    {activePanels.map((panel, index) => (
                        <div 
                            key={panel.id} 
                            className={`tab-panel ${index === tabIndex ? 'tab-panel--active' : 'tab-panel--hidden'}`}
                        >
                            {(useBubbles && panel.id !== "options")
                               ? <WordBubbles wordFilter={panel.wordFilter} allWords={words} wordSelected={wordSelected} />
                               : <WordButtons wordFilter={panel.wordFilter} allWords={words} wordSelected={wordSelected} />
                            }
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const WordButtons = ({ wordFilter, allWords, wordSelected } : WordButtonsProps) => {
    const words = wordFilter(allWords);
    let element : JSX.Element;
    if (isDirectionPicker(words)) {
        element = <CustomButtonGrid  words={words} totalColumns={9} cells={DIRECTION_GRID} wordSelected={wordSelected} />
    } else if (isOptionPicker(words)) {
        element = <CustomButtonGrid  words={words} totalColumns={4} cells={OPTION_GRID} wordSelected={wordSelected} />
    } else {
        const numColumns = getNumColumns(words);
        element = <SimpleButtonGrid words={words} columns={numColumns} wordSelected={wordSelected} />
    }
    return element;
}

const WordBubbles = ({ wordFilter, allWords, wordSelected } : WordButtonsProps) => {
    // Get border color based on dark/light theme
    const getBorderColor = () => {
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDark ? '#4a5568' : '#e2e8f0'; // gray.700 : gray.200
    };

    const words : (Word | undefined)[] = wordFilter(allWords);

    // Ensure backspace is always in the same location
    const backspaceIndex = words.findIndex(word => word?.id === BACKSPACE.id);
    if (backspaceIndex !== -1) {
        const [backspaceWord] = words.splice(backspaceIndex, 1);
        while (words.length < 4) {
            words.push(undefined);
        }
        words.splice(4,0,backspaceWord);
    }

    const BLANK_CELL = (<div></div>);

    const cells = words.map(word => word? (
        <WordButton key={word.id} word={word} wordSelected={wordSelected}/>
    ) : BLANK_CELL);

    const style : React.CSSProperties = { 
        border : `1px solid ${getBorderColor()}`,
        minHeight : "60px",
        maxHeight : "60px",
    };

    const items : BubbleGrid.Item[] = cells.map(cell => ({ item : cell, style  }));
    const hexMap = HexMap.fromSpiral(Axial.ZERO, items);
    
    // Fill out the hex map with blank cells so it looks better
    const blankCell = { item : (BLANK_CELL), style };

    const populatedRadius = hexMap.getRadius(Axial.ZERO);  
    const fillRadius = populatedRadius < 3 ? populatedRadius + 1 : populatedRadius;
    hexMap.fillHex(Axial.ZERO, fillRadius, blankCell);

    const rows  = hexMap.toArray();

    return <BubbleGrid.BubbleGrid content={rows}/>
}

// Try to fit the words into 2, 3 or 4 columns depending on the length of the longest word
const getNumColumns = (words : Word[]) : number => {
    const maxWordLength = Math.max(...words.map(word => word.value.length));
    let numColumns = 4;
    if (screen.availHeight > screen.availWidth) {
        if (maxWordLength >= 12) {
            numColumns = 2;
        } else if (maxWordLength >= 8) {
            numColumns = 3;
        }
    }
    return numColumns;
};

const SimpleButtonGrid = ({ words, columns, wordSelected } : SimpleButtonGridProps) => {
    const cells: JSX.Element[] = words.map(word => (<WordButton key={word.id} word={word} wordSelected={wordSelected}/>));
    // Pad out with empty cells so we have at least 3 rows to fill up the the grid or 
    // cells will ve stretched vertically
    const extraCells = columns * 3 - cells.length;
    for(let i=0; i<extraCells; i++) {
        cells.push((<div key={`__empty__${i}`} className="grid-empty-cell"></div>));
    }
    
    const gridStyle = {
        gridTemplateColumns: `repeat(${columns}, 1fr)`
    };

    return (
        <div className="simple-button-grid" style={gridStyle}>
            {cells}
        </div>
    );
}


const isDirectionPicker = (words : Word[]) : boolean => {
    const gameWords = words.filter(word => word.type === "word") as PartOfSpeech[];
    const isAllDirection = gameWords.length > 0 && gameWords.every(word => word.modifierType === "direction");
    return isAllDirection && words.some(word => DIRECTION_GRID.find(({ wordId }) => wordId === word.id));
}

const isOptionPicker = (words : Word[]) : boolean => words.length > 0 && words.every(word => word.type === "option");


// Generate a new Id each time space is called
const space = (() => {
    let num = 0;
    return (columns : number) => cell("__SPACE__" + (num++), columns);
})();

// |-------|-------|-------|-------|----|
// | north | north | north | up    | <- |
// | east  |       | west  |       |    |
// |-------|-------|-------|-------|----|
// |   | east  | west  |   | down  |
// |   |       |       |   |       |
// |-------|-------|-------|-------|
// | south | south | south |
// | east  |       | west  |
// |-------|-------|-------|
const DIRECTION_GRID : GridCell[] = [
    cell("northwest", 2), cell("north", 2, "north"), cell("northeast", 2), cell("up", 2), cell("__BACKSPACE__", 1),
    space(1), cell("west", 2, "west"), cell("east", 2, "east"), space(1), cell("down", 2), space(1),
    cell("southwest", 2), cell("south", 2, "south"), cell("southeast", 2)
];


const OPTION_GRID : GridCell[] = [
    cell("__option(restart)__"), cell("__option(colours)__"), cell("__option(clear)__"), space(1),
    cell("__option(undo)__", 1, "undo"), cell("__option(redo)__", 1, "redo"), cell("__option(info)__")
];

const CustomButtonGrid = ({ words, totalColumns, cells, wordSelected } : CustomButtonGridProps) => {
    const placedIds : string[] = [];
    const gridStyle = {
        gridTemplateColumns: `repeat(${totalColumns}, 1fr)`
    };
    return (
        <div className="custom-button-grid" style={gridStyle}>
            {cells.map(({ wordId, columns, defaultValue }) => {
                const word = words.find(word => word.id === wordId);
                if (word) {
                    placedIds.push(word.id);
                }
                const cellStyle = {
                    gridColumn: `span ${columns}`
                };
                return (
                    <div key={wordId} className="grid-item" style={cellStyle}>
                        {(word !== undefined)
                            ? (<WordButton key={word.id} word={word} wordSelected={wordSelected}/>)
                            : ((defaultValue)
                                ? (<WordButton key={wordId} 
                                               word={{id : wordId,
                                                      value : defaultValue,
                                                      type : "word",
                                                      partOfSpeech : "modifier",
                                                      position : 1 }}
                                               disabled={true}
                                               wordSelected={wordSelected}/>)
                                : (<></>))}
                    </div>
                )
            })}
            {words.filter(word => !placedIds.find(id => id === word.id))
                  .map(word => (
                      <div key={word.id} className="grid-item" style={{ gridColumn: 'span 1' }}>
                          <WordButton key={word.id} word={word} wordSelected={wordSelected}/>
                      </div>
                  ))}
        </div>
    );
} 

const filterWords = (words : Word[], types : WordType[]) => words.filter(word => types.includes(word.type));

export default Controls;