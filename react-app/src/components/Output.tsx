import StatusBar from "./StatusBar";
import "./Output.css";
import React from "react";

interface OutputProps {
    messages : string[];
    status : string;
}

const Output = ({ messages, status } : OutputProps) => (
    <React.Fragment>
        <div className="statusBar">
            <StatusBar status={status}/>
        </div>
        <div className="textOutWrapper">
            <div className="textOut">
                {messages.map((message : string, index : number) => (<p key={index} className="outputPara">{message}</p>))}
            </div>
        </div>
    </React.Fragment>
);

export default Output;