import { useEffect, useRef, Fragment, memo, ReactNode } from "react";
import { OutputEntry, Command } from "../outputentry";
import { TextBlock, TextSpan } from "tift-types/src/messages/textblock";
import { Optional } from "tift-types/src/util/optional";

interface OutputProps {
    entries : OutputEntry[];
    command : Command;
}

interface EntryProps {
    // `string` only occurs for scroll-back persisted before the structured
    // TextBlock[] format was introduced - see the legacy handling below.
    value : TextBlock[] | string;
}

const renderSpan = (span : TextSpan, key : number) : JSX.Element => {
    let content : ReactNode = span.text;
    if (span.bold) {
        content = <strong>{content}</strong>;
    }
    if (span.italic) {
        content = <em>{content}</em>;
    }
    if (span.strike) {
        content = <del>{content}</del>;
    }
    return <Fragment key={key}>{content}</Fragment>;
}

const renderSpans = (spans : TextSpan[]) => spans.map((span, index) => renderSpan(span, index));

// A list item containing a single paragraph renders "tight" (no extra <p>
// margin) - matching how the stdlib's list templates (one line per item)
// are meant to look.
const renderListItem = (item : TextBlock[]) : ReactNode => {
    if (item.length === 1 && item[0].type === "paragraph") {
        return renderSpans(item[0].content);
    }
    return item.map((block, index) => renderBlock(block, index));
}

const renderBlock = (block : TextBlock, key : number) : JSX.Element => {
    switch(block.type) {
        case "paragraph":
            return <p key={key}>{renderSpans(block.content)}</p>;
        case "heading": {
            const Tag = `h${Math.min(6, Math.max(1, block.level))}` as keyof JSX.IntrinsicElements;
            return <Tag key={key}>{renderSpans(block.content)}</Tag>;
        }
        case "thematicBreak":
            return <hr key={key}/>;
        case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
                <ListTag key={key}>
                    {block.items.map((item, index) => <li key={index}>{renderListItem(item)}</li>)}
                </ListTag>
            );
        }
    }
}

const BlockRenderer = ({ blocks } : { blocks : TextBlock[] }) => (
    <div className="markdown-content">{blocks.map((block, index) => renderBlock(block, index))}</div>
);

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

// Memoized so that re-rendering Output (e.g. on every word click) doesn't
// re-render every past history entry - only newly added/changed ones.
const MessageEntry = memo(({ value } : EntryProps)  => (
    <BlockRenderer blocks={typeof value === "string" ? [{ type : "paragraph", content : [{ text : value }] }] : value}/>
))
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