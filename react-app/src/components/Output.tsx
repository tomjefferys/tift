import React, { useEffect, useRef, Fragment } from "react";
import { OutputEntry, Command } from "../outputentry";
import ReactMarkdown from "react-markdown";
import { Optional } from "tift-types/src/util/optional";

// Color mappings for light/dark themes
const LEVEL_COLOURS : Record<string, [string, string]> = {
    "trace" : ["#2d3748", "#63b3ed"],   // blue.700, blue.400
    "debug" : ["#2d3748", "#63b3ed"],   // blue.700, blue.400
    "info" : ["#2d3748", "#63b3ed"],    // blue.700, blue.400
    "warn" : ["#d69e2e", "#f6e05e"],    // yellow.500, yellow.300
    "error" : ["#c53030", "#e53e3e"]    // red.700, red.600
}

const PROMPT_COLOURS : [string, string] = ["#2f855a", "#68d391"]; // green.700, green.400

interface OutputProps {
    entries : OutputEntry[];
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

const getLevelColour = (logLevel : string) : string => {
    const colours = LEVEL_COLOURS[logLevel];
    // Use CSS custom property or default to light theme
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? colours[1] : colours[0];
}

const getPromptColour = () : string => {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? PROMPT_COLOURS[1] : PROMPT_COLOURS[0];
}   

const CURSOR = (<span key={`__cursor__`} className="cursor">|</span>);

const MessageEntry = ({ value } : EntryProps)  => (
    <ReactMarkdown className="markdown-content">{value}</ReactMarkdown>
)
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
   return (
       <span className="output-text output-text--prompt" 
             style={{ color: getPromptColour() }} 
             data-testid="command">
           &gt; {words}
       </span>
   );
}
const LogEntry = ({ logLevel, message } : LogEntryProps) => (
    <span className="output-text output-text--log" 
          style={{ color: getLevelColour(logLevel) }}>
        {message}
    </span>
)

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

const Output = ({ entries, command } : OutputProps) => {

    const entriesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        entriesEndRef.current?.scrollIntoView({ behavior : "auto"});
    });

    return (
        <div className="output-container">
            <ul className="output-list">
                {entries.map((message : OutputEntry, index : number) => (
                    <li key={index} className="output-item">
                        {renderMessage(message)}
                    </li>
                ))}
                <li className="output-item">
                    <CommandEntry value={command.command} cursor={command.cursor}/>
                </li>
            </ul>
            <div ref={entriesEndRef}/>
        </div>
    );
}

export default Output;