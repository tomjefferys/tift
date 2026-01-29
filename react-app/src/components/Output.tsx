import { useEffect, useRef, Fragment } from "react";
import { OutputEntry, Command } from "../outputentry";
import ReactMarkdown from "react-markdown";
import { Optional } from "tift-types/src/util/optional";

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

const getLevelClass = (logLevel : string) : string => {
    return `output-text--log-${logLevel}`;
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
       <span className="output-text output-text--prompt" data-testid="command">
           &gt; {words}
       </span>
   );
}
const LogEntry = ({ logLevel, message }: LogEntryProps) => (
    <span className={`output-text ${getLevelClass(logLevel)}`}>
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