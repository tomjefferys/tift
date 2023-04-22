import React, { useState, useEffect } from "react";
import { Tabs, TabList, Tab, TabPanels, TabPanel, Button, Container, SimpleGrid, IconButton, Grid, GridItem} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { Word } from "tift-types/src/messages/output";
import { WordType } from "tift-types/src/messages/output";

type WordSelected = (event : React.MouseEvent<HTMLButtonElement>, word : Word) => void;

interface ControlProps {
    words : Word[];
    wordSelected : WordSelected;
}

interface WordProps {
    word : Word;
    wordSelected : WordSelected;
    disabled? : boolean;
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

const ICONS : {[key:string]:React.ReactElement} = { 
    "__BACKSPACE__" : <ArrowBackIcon/>
}

const PANELS : PanelDefinition[] = 
                [{name : "Game",   wordTypes : ["word", "control"]}, 
                 {name : "Options", wordTypes : ["option"]}];

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
    return isDirectionPicker(words)
        ? createDirectionPicker(words, wordSelected)
        : (<SimpleGrid columns={4}>
                {words.map(word => <WordButton key={word.id} word={word} wordSelected={wordSelected}/>)}
            </SimpleGrid>);
}

const isDirectionPicker = (words : Word[]) : boolean => {
    const isAllDirection = words.filter(word => word.type === "word")
                                .every(word => word.type === "word" && word.modifierType === "direction");
    return isAllDirection && words.some(word => directionItems.find(([wordId, _cols]) => wordId === word.id));
}

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

type WordId = string;
type Columns = number;
type GridEntry = [WordId, Columns];

// Generate a new Id each time space is called
const space = (() => {
    let num = 0;
    return () => {
        return "__SPACE__" + (num++);
    }
})();

const directionItems : GridEntry[] = [
    ["northwest", 2], ["north", 2], ["northeast", 2], ["up", 2], ["__BACKSPACE__", 1],
    [space(),1],["west", 2], ["east", 2], [space(), 1], ["down", 2], [space(), 1],
    ["southwest", 2], ["south",2], ["southeast", 2]
];

const alwaysDisplayed = ["north", "east", "south", "west"];

const createDirectionPicker = (words : Word[], wordSelected : WordSelected) => {
    const placedIds : string[] = [];
    return (
        <Grid templateColumns='repeat(9,1fr)'>
            {directionItems.map(item => {
                const [itemId, colSpan] = item;
                const word = words.find(word => word.id === itemId);
                if (word) {
                    placedIds.push(word.id);
                }
                return (
                    <GridItem colSpan={colSpan} key={itemId}>
                        {(word !== undefined)
                            ? (<WordButton key={word.id} word={word} wordSelected={wordSelected}/>)
                            : (alwaysDisplayed.includes(itemId)
                                ? (<WordButton key={itemId} 
                                               word={{id : itemId, value : itemId, type : "word", partOfSpeech : "modifier" }}
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

// Disable button hover effect on touchscreens
const touchScreenNoHover = {
 "@media(hover: none)": {
    _hover: { 
        bg: "hoverbg"
    }
  }, 
}

const WordButton = ({ word, wordSelected, disabled } : WordProps) => 
        (word.type === "control" && ICONS[word.id])
            ? (<IconButton variant="ghost" 
                           aria-label="backspace"
                           onClick={(event) => wordSelected(event,word)}
                           icon={ICONS[word.id]}
                           sx={touchScreenNoHover}
                           isDisabled={disabled}/>)
            : (<Button variant="ghost"
                value={word.id} 
                onClick={(event) => wordSelected(event, word)}
                sx={touchScreenNoHover}
                isDisabled={disabled}>{word.value}</Button>)

const filterWords = (words : Word[], types : WordType[]) => words.filter(word => types.includes(word.type));

export default Controls;