import { describe, test, expect } from "vitest";
import * as MD from "../src/markdown";
import { getTokenAligner } from "../src/textaligner";
import { TokenFormatter, TokenListFormatter } from "../src/tokenformatter";
import { TextBlock, TextSpan } from "tift-types/src/messages/textblock";

// Plain identity formatter, and a wide enough aligner that nothing wraps -
// isolates the block/span -> line logic in markdown.ts from the word-wrap
// behaviour that textaligner.test.ts already covers.
const IDENTITY_FORMATTER : TokenFormatter = (token) => token.text;
const wideAligner : TokenListFormatter = getTokenAligner(200, 200, IDENTITY_FORMATTER);

describe("spansToTokens", () => {
    test("should tag bold text", () => {
        const spans : TextSpan[] = [{ text: "This is " }, { text: "bold", bold: true }, { text: " text." }];
        expect(MD.spansToTokens(spans)).toEqual([
            { text: "This" },
            { text: "is" },
            { text: "bold", format: "bold" },
            { text: "text." }
        ]);
    });

    test("should tag italic text", () => {
        const spans : TextSpan[] = [{ text: "This is " }, { text: "italic", italic: true }, { text: " text." }];
        expect(MD.spansToTokens(spans)).toEqual([
            { text: "This" },
            { text: "is" },
            { text: "italic", format: "italic" },
            { text: "text." }
        ]);
    });

    test("should combine bold and italic, and mark the space between them as formatted", () => {
        const spans : TextSpan[] = [{ text: "bold italic", bold: true, italic: true }];
        expect(MD.spansToTokens(spans)).toEqual([
            { text: "bold", format: "bold-italic" },
            { text: "italic", format: "bold-italic", spaceFormat: "format_space" }
        ]);
    });

    test("should tag strikethrough as an orthogonal flag", () => {
        const spans : TextSpan[] = [{ text: "gone", strike: true }];
        expect(MD.spansToTokens(spans)).toEqual([
            { text: "gone", strikethrough: true }
        ]);
    });

    test("should combine bold, italic and strikethrough on the same word", () => {
        const spans : TextSpan[] = [{ text: "all", bold: true, italic: true, strike: true }];
        expect(MD.spansToTokens(spans)).toEqual([
            { text: "all", format: "bold-italic", strikethrough: true }
        ]);
    });

    test("should force bold via the heading override even when the span isn't bold", () => {
        const spans : TextSpan[] = [{ text: "Title" }];
        expect(MD.spansToTokens(spans, { bold: true })).toEqual([
            { text: "Title", format: "bold" }
        ]);
    });

    test("should not mark the space as formatted between differently-formatted words", () => {
        const spans : TextSpan[] = [{ text: "bold", bold: true }, { text: " italic", italic: true }];
        expect(MD.spansToTokens(spans)).toEqual([
            { text: "bold", format: "bold" },
            { text: "italic", format: "italic" }
        ]);
    });
});

describe("renderBlocks", () => {
    test("should render a single paragraph as one line", () => {
        const blocks : TextBlock[] = [
            { type: "paragraph", content: [{ text: "Hello world" }] }
        ];
        expect(MD.renderBlocks(blocks, wideAligner)).toEqual(["Hello world"]);
    });

    test("should separate blocks with a blank line", () => {
        const blocks : TextBlock[] = [
            { type: "paragraph", content: [{ text: "First paragraph" }] },
            { type: "paragraph", content: [{ text: "Second paragraph" }] }
        ];
        expect(MD.renderBlocks(blocks, wideAligner)).toEqual([
            "First paragraph",
            "",
            "Second paragraph"
        ]);
    });

    test("should render a heading in bold regardless of its own span formatting", () => {
        const revealFormat : TokenFormatter = (token) => token.format === "bold" ? `[${token.text}]` : token.text;
        const aligner = getTokenAligner(200, 200, revealFormat);
        const blocks : TextBlock[] = [
            { type: "heading", level: 1, content: [{ text: "Title" }] }
        ];
        expect(MD.renderBlocks(blocks, aligner)).toEqual(["[Title]"]);
    });

    test("should render an unordered list with bullets", () => {
        const blocks : TextBlock[] = [
            { type: "list", ordered: false, items: [
                [{ type: "paragraph", content: [{ text: "one" }] }],
                [{ type: "paragraph", content: [{ text: "two" }] }]
            ]}
        ];
        expect(MD.renderBlocks(blocks, wideAligner)).toEqual(["• one", "• two"]);
    });

    test("should render an ordered list with numbers", () => {
        const blocks : TextBlock[] = [
            { type: "list", ordered: true, items: [
                [{ type: "paragraph", content: [{ text: "one" }] }],
                [{ type: "paragraph", content: [{ text: "two" }] }]
            ]}
        ];
        expect(MD.renderBlocks(blocks, wideAligner)).toEqual(["1. one", "2. two"]);
    });

    test("should render a thematic break as a single rule line filling the available width", () => {
        const narrowAligner = getTokenAligner(10, 10, IDENTITY_FORMATTER);
        const blocks : TextBlock[] = [{ type: "thematicBreak" }];
        const lines = MD.renderBlocks(blocks, narrowAligner);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^─+$/);
        expect(lines[0]).toHaveLength(10);
    });

    test("should render strikethrough text distinctly from plain text", () => {
        const revealStrike : TokenFormatter = (token) => token.strikethrough ? `~${token.text}~` : token.text;
        const aligner = getTokenAligner(200, 200, revealStrike);
        const blocks : TextBlock[] = [
            { type: "paragraph", content: [{ text: "keep " }, { text: "gone", strike: true }] }
        ];
        expect(MD.renderBlocks(blocks, aligner)).toEqual(["keep ~gone~"]);
    });
});
