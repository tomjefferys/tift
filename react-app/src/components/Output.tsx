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

const MessageEntry = ({ value } : EntryProps)  => (<div className="outputMessage"><ReactMarkdown>{value}</ReactMarkdown></div>)
const CommandEntry = ({ value } : EntryProps) => (<p className="outputCommand">&gt; {value}</p>)

const Output = ({ entries, status, command } : OutputProps) => {

    const entriesEndRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        entriesEndRef.current?.scrollIntoView({ behavior : "auto"});
    });

    return (
        <React.Fragment>
            <div className="statusBar">
                <StatusBar status={status}/>
            </div>
            <div className="textOutWrapper">
                <div className="textOut">
                    {entries.map((message : OutputEntry, index : number) =>
                                    ((message.type === "message")
                                        ? <MessageEntry key={index} value={message.message}/>
                                        : <CommandEntry key={index} value={message.command}/>))}
                    <CommandEntry value={command}/>
                </div>

                <div ref={entriesEndRef}/>
            </div>
        </React.Fragment>
    );
}

export default Output;