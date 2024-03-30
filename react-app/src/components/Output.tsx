import StatusBar from "./StatusBar";
import React, { useEffect, useRef, Fragment } from "react";
import { OutputEntry, Command } from "../outputentry";
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import ReactMarkdown from "react-markdown";
import { Box, Container, List, ListItem, Text } from "@chakra-ui/react";
import { Optional } from "tift-types/src/util/optional";

const LEVEL_COLOURS : Record<string, string> = {
    "info" : "blue",
    "warn" : "yellow",
    "error" : "red"
}

interface OutputProps {
    entries : OutputEntry[];
    status : string;
    command : Command;
}

interface EntryProps {
    value : string;
}

interface CommandEntryProps {
    value : string[];
    cursor : number;
}

interface LogEntryProps {
    logLevel : string,
    message : string
}

const CURSOR = (<span key={`__cursor__`} className="cursor">|</span>);

const MessageEntry = ({ value } : EntryProps)  => (<ReactMarkdown components={ChakraUIRenderer()}>{value}</ReactMarkdown>)
const CommandEntry = ({ value, cursor } : CommandEntryProps) => {
    const words : JSX.Element[] = [];
    value.forEach((word, index) => {
        let cursorFragment : Optional<JSX.Element> = undefined;
        if (index === cursor) {
            cursorFragment = CURSOR;
        }
        words.push(<Fragment key={`${word}${index}`}>{word}{cursorFragment}&nbsp;</Fragment>);
    });
    if (words.length === 0) {
        words.push(CURSOR);
    }
   return (<Text color={"green"} data-testid="command">&gt; {words}</Text>);
}
const LogEntry = ({ logLevel, message } : LogEntryProps) => (<Text color={LEVEL_COLOURS[logLevel]}>{message}</Text>)

const renderMessage = (message : OutputEntry) => {
    switch(message.type) {
        case "message": 
            return <MessageEntry value={message.message}/>;
        case "command":
            return <CommandEntry value={message.command} cursor={message.cursor}/>;
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
                    <ListItem><CommandEntry value={command.command} cursor={command.cursor}/></ListItem>
                </List>
                <div ref={entriesEndRef}/>
                </Container>
            </Box>
        </React.Fragment>
    );
}

export default Output;