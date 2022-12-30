import React from "react";
import { IdValue } from "tift-engine/src/shared";
import { Tabs, TabList, Tab, TabPanels, TabPanel, Button, Container, SimpleGrid } from "@chakra-ui/react";

interface ControlProps {
    words : IdValue<string>[];
    wordSelected : (event : React.MouseEvent<HTMLButtonElement>, word : IdValue<string>) => void;
}

interface WordProps {
    word : IdValue<string>;
    wordSelected : (event : React.MouseEvent<HTMLButtonElement>, word : IdValue<string>) => void;
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
                <SimpleGrid columns={4}>
                    {words.map(word => <WordButton key={word.id} word={word} wordSelected={wordSelected}/>)}
                </SimpleGrid>
            </TabPanel>
            <TabPanel>
                <strong>Options Panel</strong>
            </TabPanel>
        </TabPanels>
    </Tabs>
    </Container>
);

const WordButton = ({ word, wordSelected } : WordProps) => (
        <Button variant="ghost"
                value={word.id} 
                onClick={(event) => wordSelected(event, word)}>{word.value}</Button>
)

export default Controls;