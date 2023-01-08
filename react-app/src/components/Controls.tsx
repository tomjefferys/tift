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
                <TabList>{PANELS.map(panel => (<Tab>{panel.name}</Tab>))}</TabList>
                <TabPanels>{PANELS.map(panel => (
                    <TabPanel>
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

const WordButton = ({ word, wordSelected } : WordProps) => 
        (word.type === "control" && ICONS[word.id])
            ? (<IconButton variant="ghost" 
                           aria-label="backspace"
                           onClick={(event) => wordSelected(event,word)}
                           icon={ICONS[word.id]}/>)
            : (<Button variant="ghost"
                value={word.id} 
                onClick={(event) => wordSelected(event, word)}>{word.value}</Button>)

const filterWords = (words : Word[], types : WordType[]) => words.filter(word => types.includes(word.type));

export default Controls;