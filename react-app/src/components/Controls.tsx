import React from "react";
import { Tabs, TabList, Tab, TabPanels, TabPanel, Button, Container, SimpleGrid } from "@chakra-ui/react";
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
    wordType : WordType,
    allWords : Word[],
    wordSelected : WordSelected;
}

const Controls = ({ words, wordSelected } : ControlProps) => (
    <Container>
      <Tabs>
        <TabList>
            <Tab>Game</Tab>
            <Tab>Options</Tab>
        </TabList>
        <TabPanels>
            <TabPanel>
                <WordButtons wordType="word" allWords={words} wordSelected={wordSelected} />
            </TabPanel>
            <TabPanel>
                <WordButtons wordType="command" allWords={words} wordSelected={wordSelected} />
            </TabPanel>
        </TabPanels>
    </Tabs>
    </Container>
);

const WordButtons = ({ wordType, allWords, wordSelected } : WordButtonsProps) => {
    const words = allWords.filter(word => word.type === wordType);
    return (<SimpleGrid columns={4}>
                {words.map(word => <WordButton key={word.id} word={word} wordSelected={wordSelected}/>)}
            </SimpleGrid>)
}
    



const WordButton = ({ word, wordSelected } : WordProps) => (
        <Button variant="ghost"
                value={word.id} 
                onClick={(event) => wordSelected(event, word)}>{word.value}</Button>
)

export default Controls;