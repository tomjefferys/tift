import StatusBar from "./StatusBar";
import "./Output.css";
import React, { useEffect, useRef } from "react";
import { OutputEntry } from "../outputentry";
import ReactMarkdown from "react-markdown";

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

const MessageEntry = ({ value } : EntryProps)  => (<div className="outputMessage"><ReactMarkdown>{value}</ReactMarkdown></div>)
const CommandEntry = ({ value } : EntryProps) => (<p className="outputCommand">&gt; {value}</p>)
const LogEntry = ({ logLevel, message } : LogEntryProps) => 
        (<div className={"log-" + logLevel}> {message}{} </div>)

const Output = ({ entries, status, command } : OutputProps) => {

    const entriesEndRef = useRef<HTMLDivElement>(null);
    const statusBarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        entriesEndRef.current?.scrollIntoView({ behavior : "auto"});
        statusBarRef.current?.scrollIntoView({ behavior : "auto" });
    });

    return (
        <React.Fragment>
            <div className="statusBar" ref={statusBarRef}>
                <StatusBar status={status}/>
            </div>
            <div className="textOutWrapper">
                <div className="textOut">
                    {entries.map((message : OutputEntry, index : number) => {
                        switch(message.type) {
                            case "message": 
                                return <MessageEntry key={index} value={message.message}/>;
                            case "command":
                                return <CommandEntry key={index} value={message.command}/>;
                            case "log":
                                return <LogEntry key={index} 
                                                 logLevel={message.level}
                                                 message={message.message}/>;

                        }
                    })}
                    <CommandEntry value={command}/>
                </div>

                <div ref={entriesEndRef}/>
            </div>
        </React.Fragment>
    );
}

export default Output;