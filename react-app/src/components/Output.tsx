import StatusBar from "./StatusBar";

interface OutputProps {
    messages : string[];
    status : string;
}

const Output = ({ messages, status } : OutputProps) => (
    <div id="outputArea">
        <StatusBar status={status}/>
        {messages.map((message : string, index : number) => (<p key={index}>{message}</p>))}
    </div>
);

export default Output;