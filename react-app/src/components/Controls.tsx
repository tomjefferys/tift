import React, { useState, useEffect } from "react";
import { Tabs, TabList, Tab, TabPanels, TabPanel, Button, Container, SimpleGrid, IconButton } from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { Word } from "tift-engine/src/messages/output";
import { WordType } from "tift-engine/out/src/messages/output";

type WordSelected = (event : React.MouseEvent<HTMLButtonElement>, word : Word) => void;

interface ControlProps {
    words : Word[];
    wordSelected : WordSelected;
}

interface WordProps {
    word : Word;
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
    return (<SimpleGrid columns={4}>
                {words.map(word => <WordButton key={word.id} word={word} wordSelected={wordSelected}/>)}
            </SimpleGrid>)
}

// Disable button hover effect on touchscreens
const touchScreenNoHover = {
 "@media(hover: none)": {
    _hover: { 
        bg: "hoverbg"
    }
  }, 
}

const WordButton = ({ word, wordSelected } : WordProps) => 
        (word.type === "control" && ICONS[word.id])
            ? (<IconButton variant="ghost" 
                           aria-label="backspace"
                           onClick={(event) => wordSelected(event,word)}
                           icon={ICONS[word.id]}
                           sx={touchScreenNoHover}/>)
            : (<Button variant="ghost"
                value={word.id} 
                onClick={(event) => wordSelected(event, word)}
                sx={touchScreenNoHover}>{word.value}</Button>)

const filterWords = (words : Word[], types : WordType[]) => words.filter(word => types.includes(word.type));

export default Controls;