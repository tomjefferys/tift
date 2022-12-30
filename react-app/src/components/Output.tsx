import StatusBar from "./StatusBar";
import "./Output.css";
import React, { useEffect, useRef } from "react";
import { OutputEntry } from "../outputentry";
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import ReactMarkdown from "react-markdown";
import { Box, Container, List, ListItem, Text } from "@chakra-ui/react";

interface OutputProps {
    entries : OutputEntry[];
    status : string;
    command : string;
}

interface EntryProps {
    value : string;
}

interface LogEntryProps {
    logLevel : string,
    message : string
}

const MessageEntry = ({ value } : EntryProps)  => (<ReactMarkdown components={ChakraUIRenderer()}>{value}</ReactMarkdown>)
const CommandEntry = ({ value } : EntryProps) => (<Text color={"green"}>&gt; {value}</Text>)
const LogEntry = ({ logLevel, message } : LogEntryProps) => 
        (<div className={"log-" + logLevel}> {message}{} </div>)

const renderMessage = (message : OutputEntry) => {
    switch(message.type) {
        case "message": 
            return <MessageEntry value={message.message}/>;
        case "command":
            return <CommandEntry value={message.command}/>;
        case "log":
            return <LogEntry logLevel={message.level} message={message.message}/>;

    }
}

const Output = ({ entries, status, command } : OutputProps) => {

    const entriesEndRef = useRef<HTMLDivElement>(null);
    const statusBarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        entriesEndRef.current?.scrollIntoView({ behavior : "auto"});
        statusBarRef.current?.scrollIntoView({ behavior : "auto" });
    });

    return (
        <React.Fragment>
            <StatusBar status={status}/>
            <Box overflow={"auto"} h="90%" w="100%" overflowY={"scroll"}>
                <Container textAlign={"left"}>
                <List>
                    {entries.map((message : OutputEntry, index : number) => (<ListItem key={index}>{renderMessage(message)}</ListItem>))}
                    <ListItem><CommandEntry value={command}/></ListItem>
                </List>
                <div ref={entriesEndRef}/>
                </Container>
            </Box>
        </React.Fragment>
    );
}

export default Output;