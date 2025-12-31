import React, { useState, useEffect } from "react";
import { Tabs, TabList, Tab, TabPanels, TabPanel, Container, SimpleGrid, Grid, GridItem, Box, useColorModeValue, useToken} from "@chakra-ui/react";
import { PartOfSpeech, Word } from "tift-types/src/messages/word";
import { WordType } from "tift-types/src/messages/output";
import WordButton from "./WordButton";

import { Axial, HexMap } from "../util/hex";
import * as BubbleGrid from "./bubbleGrid/BubbleGrid";

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
                [{id : "bubbles", name : "Game", wordFilter : words => filterWords(words, ["word", "control"])},
                 {id : "normal", name : "Game",   wordFilter : words => filterWords(words, ["word", "control"])
                                                            .filter(word => !word.tags?.includes("inventory"))}, 
                 {id : "inventory", name : "Inventory", wordFilter : words => filterWords(words, ["word"])
                                                              .filter(word => word.tags?.includes("inventory"))},
                 {id : "options", name : "Options", wordFilter : words => filterWords(words, ["option", "select"])}];

const Controls = ({ words, wordSelected, panelIds } : ControlProps) => {

    const [tabIndex, setTabIndex] = useState(0);

    const handleTabsChange = (index : number) => setTabIndex(index);

    const activePanels = PANELS.filter(panel => panelIds.includes(panel.id));

    // Reset the tabs if the words change
    useEffect(() => {
        const wordCounts = activePanels.map(panel => panel.wordFilter(words).length)
        const firstPanelWithContent = wordCounts.findIndex(count => count > 0);
        if (firstPanelWithContent >= 0) {
            console.log("Setting tab index to ", firstPanelWithContent);
            setTabIndex(firstPanelWithContent);
        }
    }, [words]);

    return (
        // eslint-disable-next-line
        // @ts-ignore ignore "Expression produces a union type that is too complex to represent.ts(2590)"
        <Container h="100%">
            <Tabs h="100%" index={tabIndex} onChange={handleTabsChange}>
                <TabList>{activePanels.map(panel => (<Tab key={panel.id}>{panel.name}</Tab>))}</TabList>
                <TabPanels h="85%">{activePanels.map(panel => (
                    <TabPanel h="100%" key={panel.id} padding={0}>{
                        panel.id === "bubbles" 
                            ? <WordBubbles wordFilter={panel.wordFilter} allWords={words} wordSelected={wordSelected} />
                            : <WordButtons wordFilter={panel.wordFilter} allWords={words} wordSelected={wordSelected} />
                        }
                    </TabPanel>))}
                </TabPanels>
            </Tabs>
        </Container>)
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
    const borderColourToken = useColorModeValue('gray.200', 'gray.700');
    const [borderColour] = useToken('colors', [borderColourToken]);
    const words = wordFilter(allWords);
    const cells = words.map(word => (
        <WordButton key={word.id} word={word} wordSelected={wordSelected}/>
    ));


    const style : React.CSSProperties = { 
        border : `1px solid ${borderColour}`,
        minHeight : "60px",
        maxHeight : "60px",
    };

    const items : BubbleGrid.Item[] = cells.map(cell => ({ item : cell, style  }));
    const hexMap = HexMap.fromSpiral(Axial.ZERO, items);
    
    // Fill out the hex map with blank cells so it looks better
    const blankCell = { item : (<div></div>), style };

    const populatedRadius = hexMap.getRadius(Axial.ZERO);  
    hexMap.fillHex(Axial.ZERO, populatedRadius, blankCell);

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
        cells.push((<Box key={`__empty__${i}`}></Box>));
    }
    return (
        <SimpleGrid columns={columns} h="100%" w="100%" overflow={"auto"} overflowY={"scroll"} gridAutoRows="1fr">
            {cells}
        </SimpleGrid>);
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
    const templateColumns = `repeat(${totalColumns},1fr)`;
    return (
        <Grid templateColumns={templateColumns}>
            {cells.map(({ wordId, columns, defaultValue }) => {
                const word = words.find(word => word.id === wordId);
                if (word) {
                    placedIds.push(word.id);
                }
                return (
                    <GridItem colSpan={columns} key={wordId}>
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
                    </GridItem>
                )
            })}
            {words.filter(word => !placedIds.find(id => id === word.id))
                  .map(word => (<GridItem colSpan={1} key={word.id}><WordButton key={word.id} word={word} wordSelected={wordSelected}/></GridItem>))}
        </Grid>
    );
} 

const filterWords = (words : Word[], types : WordType[]) => words.filter(word => types.includes(word.type));

export default Controls;