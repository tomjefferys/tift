import { parse, blocksToText } from "../../src/util/markdownparser";
import { TextBlock } from "tift-types/src/messages/textblock";

test("Test plain text becomes a single paragraph", () => {
    expect(parse("Hello world")).toEqual([
        { type : "paragraph", content : [{ text : "Hello world" }] }
    ]);
});

test("Test bold and italic formatting", () => {
    expect(parse("A **bold** and *italic* word")).toEqual([
        { type : "paragraph", content : [
            { text : "A " },
            { text : "bold", bold : true },
            { text : " and " },
            { text : "italic", italic : true },
            { text : " word" }
        ]}
    ]);
});

test("Test bold and italic can nest", () => {
    expect(parse("***both***")).toEqual([
        { type : "paragraph", content : [
            { text : "both", bold : true, italic : true }
        ]}
    ]);
});

test("Test strikethrough formatting", () => {
    expect(parse("~~gone~~")).toEqual([
        { type : "paragraph", content : [
            { text : "gone", strike : true }
        ]}
    ]);
});

test("Test blank line separates paragraphs (as produced by {{br}})", () => {
    expect(parse("First paragraph\n\nSecond paragraph")).toEqual([
        { type : "paragraph", content : [{ text : "First paragraph" }] },
        { type : "paragraph", content : [{ text : "Second paragraph" }] }
    ]);
});

test("Test horizontal rule (as produced by {{hr}}) is not read as a heading underline", () => {
    const blocks = parse("Some text\n\n---\n\nMore text");
    expect(blocks).toEqual([
        { type : "paragraph", content : [{ text : "Some text" }] },
        { type : "thematicBreak" },
        { type : "paragraph", content : [{ text : "More text" }] }
    ]);
});

test("Test bullet list", () => {
    expect(parse("- one\n- two\n- three")).toEqual([
        { type : "list", ordered : false, items : [
            [{ type : "paragraph", content : [{ text : "one" }] }],
            [{ type : "paragraph", content : [{ text : "two" }] }],
            [{ type : "paragraph", content : [{ text : "three" }] }]
        ]}
    ]);
});

test("Test heading", () => {
    expect(parse("# Title")).toEqual([
        { type : "heading", level : 1, content : [{ text : "Title" }] }
    ]);
    expect(parse("### Sub title")).toEqual([
        { type : "heading", level : 3, content : [{ text : "Sub title" }] }
    ]);
});

test("Test blocksToText flattens paragraphs, lists, headings and rules to plain text", () => {
    const blocks : TextBlock[] = [
        { type : "heading", level : 1, content : [{ text : "Title" }] },
        { type : "paragraph", content : [
            { text : "Some " },
            { text : "bold", bold : true },
            { text : " text" }
        ]},
        { type : "thematicBreak" },
        { type : "list", ordered : false, items : [
            [{ type : "paragraph", content : [{ text : "one" }] }],
            [{ type : "paragraph", content : [{ text : "two" }] }]
        ]}
    ];
    expect(blocksToText(blocks)).toEqual(
        "Title\n\nSome bold text\n\n---\n\n- one\n- two"
    );
});
