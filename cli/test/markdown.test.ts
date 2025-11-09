import { describe, test, expect } from "vitest";
import * as MD from "../src/markdown";

describe("Markdown Parser", () => {

    test("should parse bold text", () => {
        const input = "This is **bold** text.";
        const parsed = MD.parseMarkdown(input);
        expect(parsed).toEqual([
            { format: "plain", text: "This" },
            { format: "plain", text: "is" },
            { format: "bold", text: "bold" },
            { format: "plain", text: "text." }
        ]);
    });

    test("should parse italic text", () => {
        const input = "This is *italic* text.";
        const parsed = MD.parseMarkdown(input);
        expect(parsed).toEqual([
            { format: "plain", text: "This" },
            { format: "plain", text: "is" },
            { format: "italic", text: "italic" },
            { format: "plain", text: "text." }
        ]);
    });

    test("should parse bold-italic text", () => {
        const input = "This is ***bold italic*** text.";
        const parsed = MD.parseMarkdown(input);
        expect(parsed).toEqual([
            { format: "plain", text: "This" },
            { format: "plain", text: "is" },
            { format: "bold-italic", text: "bold" },
            { format: "bold-italic", text: "italic" },
            { format: "plain", text: "text." }
        ]);
    });

    test("Should parse mixed formatting", () => {
        const input = "This is **bold**, *italic*, and ***bold italic***.";
        const parsed = MD.parseMarkdown(input);
        expect(parsed).toEqual([
            { format: "plain", text: "This" },
            { format: "plain", text: "is" },
            { format: "bold", text: "bold" },
            { format: "plain", text: "," },
            { format: "italic", text: "italic" },
            { format: "plain", text: "," },
            { format: "plain", text: "and" },
            { format: "bold-italic", text: "bold" },
            { format: "bold-italic", text: "italic" },
            { format: "plain", text: "." }
        ]);
    });
});
