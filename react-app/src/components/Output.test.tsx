import { render, screen } from "@testing-library/react";
import Output from "./Output";
import { messageEntry, commandEntry, logEntry, Command, Message } from "../outputentry";
import { TextBlock } from "tift-types/src/messages/textblock";

const NO_COMMAND : Command = commandEntry([], 0);

beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function() { /* not implemented in jsdom */ };
});

test("renders a paragraph", () => {
    const blocks : TextBlock[] = [
        { type: "paragraph", content: [{ text: "Hello world" }] }
    ];
    const { container } = render(<Output entries={[messageEntry(blocks)]} command={NO_COMMAND}/>);
    const paragraph = container.querySelector("p");
    expect(paragraph).not.toBeNull();
    expect(paragraph).toHaveTextContent("Hello world");
});

test("renders bold, italic and strikethrough spans", () => {
    const blocks : TextBlock[] = [
        { type: "paragraph", content: [
            { text: "bold", bold: true },
            { text: "italic", italic: true },
            { text: "gone", strike: true }
        ]}
    ];
    render(<Output entries={[messageEntry(blocks)]} command={NO_COMMAND}/>);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
    expect(screen.getByText("gone").tagName).toBe("DEL");
});

test("renders a horizontal rule", () => {
    const blocks : TextBlock[] = [{ type: "thematicBreak" }];
    const { container } = render(<Output entries={[messageEntry(blocks)]} command={NO_COMMAND}/>);
    expect(container.querySelector("hr")).not.toBeNull();
});

test("renders a heading", () => {
    const blocks : TextBlock[] = [
        { type: "heading", level: 2, content: [{ text: "Title" }] }
    ];
    const { container } = render(<Output entries={[messageEntry(blocks)]} command={NO_COMMAND}/>);
    const heading = container.querySelector("h2");
    expect(heading).not.toBeNull();
    expect(heading).toHaveTextContent("Title");
});

test("renders a bullet list, one item per line", () => {
    const blocks : TextBlock[] = [
        { type: "list", ordered: false, items: [
            [{ type: "paragraph", content: [{ text: "one" }] }],
            [{ type: "paragraph", content: [{ text: "two" }] }]
        ]}
    ];
    const { container } = render(<Output entries={[messageEntry(blocks)]} command={NO_COMMAND}/>);
    // Scoped to the rendered message content, since Output itself also
    // wraps entries in an (unrelated) top-level <ul className="output-list">.
    const list = container.querySelector(".markdown-content ul");
    expect(list).not.toBeNull();
    const items = list?.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items?.[0]).toHaveTextContent("one");
    expect(items?.[1]).toHaveTextContent("two");
});

test("renders an ordered list as <ol>", () => {
    const blocks : TextBlock[] = [
        { type: "list", ordered: true, items: [
            [{ type: "paragraph", content: [{ text: "one" }] }]
        ]}
    ];
    const { container } = render(<Output entries={[messageEntry(blocks)]} command={NO_COMMAND}/>);
    expect(container.querySelector("ol")).not.toBeNull();
});

test("renders legacy string scroll-back entries as a plain paragraph", () => {
    const legacyEntry = messageEntry([]) as Message;
    legacyEntry.message = "Old saved message";
    const { container } = render(<Output entries={[legacyEntry]} command={NO_COMMAND}/>);
    const paragraph = container.querySelector("p");
    expect(paragraph).toHaveTextContent("Old saved message");
});

test("renders log entries", () => {
    render(<Output entries={[logEntry("warn", "careful now")]} command={NO_COMMAND}/>);
    expect(screen.getByText("careful now")).toBeInTheDocument();
});
