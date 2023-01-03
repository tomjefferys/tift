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

const ICONS : {[key:string]:React.ReactElement} = { 
    "__BACKSPACE__" : <ArrowBackIcon/>
}

const Controls = ({ words, wordSelected } : ControlProps) => {

    const [tabIndex, setTabIndex] = useState(0);

    const handleTabsChange = (index : number) => setTabIndex(index);

    // Reset the tabs, if the words change
    useEffect(() => {
        setTabIndex(0);
    }, [words]);
    return (
        <Container>
            <Tabs index={tabIndex} onChange={handleTabsChange}>
                <TabList>
                    <Tab>Game</Tab>
                    <Tab>Options</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel>
                        <WordButtons wordTypes={["word","control"]} allWords={words} wordSelected={wordSelected} />
                    </TabPanel>
                    <TabPanel>
                        <WordButtons wordTypes={["option"]} allWords={words} wordSelected={wordSelected} />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </Container>)
    };

const WordButtons = ({ wordTypes, allWords, wordSelected } : WordButtonsProps) => {
    const words = allWords.filter(word => wordTypes.includes(word.type));
    return (<SimpleGrid columns={4}>
                {words.map(word => <WordButton key={word.id} word={word} wordSelected={wordSelected}/>)}
            </SimpleGrid>)
}

const WordButton = ({ word, wordSelected } : WordProps) => 
        (word.type === "control" && ICONS[word.id])
            ? (<IconButton variant="ghost" 
                           aria-label="backspace"
                           onClick={(event) => wordSelected(event,word)}
                           icon={ICONS[word.id]}/>)
            : (<Button variant="ghost"
                value={word.id} 
                onClick={(event) => wordSelected(event, word)}>{word.value}</Button>)

export default Controls;