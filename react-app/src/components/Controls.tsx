import React, { useState, useEffect } from "react";
import { Tabs, TabList, Tab, TabPanels, TabPanel, Container, SimpleGrid, Grid, GridItem} from "@chakra-ui/react";
import { Word } from "tift-types/src/messages/output";
import { WordType } from "tift-types/src/messages/output";
import WordButton from "./WordButton";

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
}

interface WordButtonsProps {
    wordTypes : WordType[],
    allWords : Word[],
    wordSelected : WordSelected;
}

interface PanelDefinition {
    name : string;
    wordTypes : WordType[];
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
                [{name : "Game",   wordTypes : ["word", "control"]}, 
                 {name : "Options", wordTypes : ["option", "select"]}];

const Controls = ({ words, wordSelected } : ControlProps) => {

    const [tabIndex, setTabIndex] = useState(0);

    const handleTabsChange = (index : number) => setTabIndex(index);

    // Reset the tabs if the words change
    useEffect(() => {
        const wordCounts = PANELS.map(panel => filterWords(words, panel.wordTypes).length)
        const firstPanelWithContent = wordCounts.findIndex(count => count > 0);
        if (firstPanelWithContent >= 0) {
            setTabIndex(firstPanelWithContent);
        }
    }, [words]);

    return (
        <Container>
            <Tabs index={tabIndex} onChange={handleTabsChange}>
                <TabList>{PANELS.map(panel => (<Tab key={panel.name}>{panel.name}</Tab>))}</TabList>
                <TabPanels>{PANELS.map(panel => (
                    <TabPanel key={panel.name}>
                        <WordButtons wordTypes={panel.wordTypes} allWords={words} wordSelected={wordSelected} />
                    </TabPanel>))}
                </TabPanels>
            </Tabs>
        </Container>)
};

const WordButtons = ({ wordTypes, allWords, wordSelected } : WordButtonsProps) => {
    const words = filterWords(allWords, wordTypes);
    let element : JSX.Element;
    if (isDirectionPicker(words)) {
        element = <CustomButtonGrid  words={words} totalColumns={9} cells={DIRECTION_GRID} wordSelected={wordSelected} />
    } else if (isOptionPicker(words)) {
        element = <CustomButtonGrid  words={words} totalColumns={4} cells={OPTION_GRID} wordSelected={wordSelected} />
    } else {
        element = <SimpleButtonGrid words={words} columns={4} wordSelected={wordSelected} />
    }
    return element;
}

const SimpleButtonGrid = ({ words, columns, wordSelected } : SimpleButtonGridProps) =>
    <SimpleGrid columns={columns}>
        {words.map(word => <WordButton key={word.id} word={word} wordSelected={wordSelected}/>)}
    </SimpleGrid>


const isDirectionPicker = (words : Word[]) : boolean => {
    const isAllDirection = words.filter(word => word.type === "word")
                                .every(word => word.type === "word" && word.modifierType === "direction");
    return isAllDirection && words.some(word => DIRECTION_GRID.find(({ wordId }) => wordId === word.id));
}

const isOptionPicker = (words : Word[]) : boolean => words.every(word => word.type === "option");


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
                                               word={{id : wordId, value : defaultValue, type : "word", partOfSpeech : "modifier" }}
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