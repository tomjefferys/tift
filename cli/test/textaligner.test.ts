import { getTokenAligner } from "../src/textaligner";
import { TokenFormatter } from "../src/tokenformatter";
import { describe, test, expect } from "vitest";
import { FormattedToken } from "../src/formattedToken";

describe("TextAligner", () => {
    test("should align tokens correctly on single line", () => {
        const consoleWidth = 20;
        const textWidth = 15;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "Hello", format: "plain" },
            { text: "World", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual(["  Hello World"]);
    });

    test("should align tokens correctly on multiple lines", () => {
        const consoleWidth = 11;
        const textWidth = 7;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "This", format: "plain" },
            { text: "is", format: "plain" },
            { text: "a", format: "plain" },
            { text: "test", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            "  This is",
            "  a test",
        ]);
    });

    test("should work with long token", () => {
        const consoleWidth = 10;
        const textWidth = 10;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "Short", format: "plain" },
            { text: "LongTokenHere", format: "plain" },
            { text: "Short", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            "Short",
            "LongTokenH",
            "ere Short",
        ]);
    });

    test("Should pad lines with long token correctly", () => {
        const consoleWidth = 12;
        const textWidth = 8;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "LongTokenHere", format: "plain" },
            { text: "End", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            "  LongToke",
            "  nHere",
            "  End",
        ]);
    });

    test("Should correctly split really long tokens over multiple lines", () => {
        const consoleWidth = 14;
        const textWidth = 9;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "ThisIsAVeryLongTokenThatExceedsWidth", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            "  ThisIsAVe",
            "  ryLongTok",
            "  enThatExc",
            "  eedsWidth",
        ]);
    });

    test("Should handle tokens that exactly fit the line", () => {
        const consoleWidth = 12;
        const textWidth = 10;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "1234567890", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            " 1234567890",
        ]);
    });

    test("should work with empty tokens", () => {
        const consoleWidth = 10;
        const textWidth = 10;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([]);
    }); 

    test("should handle tabbed tokens correctly", () => {
        const consoleWidth = 20;
        const textWidth = 15;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "one", format: "plain", space: "tab" },
            { text: "two", format: "plain", space: "tab" },
            { text: "three", format: "plain", space: "tab" },
            { text: "four", format: "plain", space: "tab" },
            { text: "five", format: "plain", space: "tab" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            "  one     two",
            "  three   four",
            "  five",
        ]);
    });

    test("should handle mixed tabbed and untabbed tokens", () => {
        const consoleWidth = 25;
        const textWidth = 20;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "start", format: "plain" },
            { text: "one", format: "plain", space: "tab" },
            { text: "two", format: "plain", space: "tab" },
            { text: "middle", format: "plain" },
            { text: "three", format: "plain", space: "tab" },
            { text: "four", format: "plain", space: "tab" },
            { text: "end", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            "  start   one     two",
            "  middle  three   four",
            "  end",
        ]);
    });

    test("Should handle tabbed tokens that exceed line width", () => {
        const consoleWidth = 22;
        const textWidth = 18;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "one", format: "plain", space: "tab" },
            { text: "two", format: "plain", space: "tab" },
            { text: "three", format: "plain", space: "tab" },
            { text: "four", format: "plain", space: "tab" },
        ];
        
        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            "  one     two",
            "  three   four"
        ]);
    });

    test("Should handle extremely long token", () => {
        const consoleWidth = 8
        const textWidth = 6;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);
        
        const tokens : FormattedToken[] = [
            { text: "ExtremelyLongTokenThatExceedsAllWidths", format: "plain" },
        ];
        
        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            " Extrem",
            " elyLon",
            " gToken",
            " ThatEx",
            " ceedsA",
            " llWidt",
            " hs"
        ]);
    })

    test("Should handle tokens with length equal to tab size", () => {
        const consoleWidth = 24;
        const textWidth = 20;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "one", format: "plain", space: "tab" },
            { text: "two", format: "plain", space: "tab" },
            { text: "thr", format: "plain", space: "tab" },
            { text: "12345678", format: "plain", space: "tab" },
            { text: "abcdefgh", format: "plain", space: "tab" },
            { text: "WXYZ", format: "plain", space: "tab" },
        ];
        
        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            "  one     two     thr",
            "  12345678",
            "  abcdefgh        WXYZ"
        ]);
    });

    test("Should handle join tokens correctly", () => {
        const consoleWidth = 20;
        const textWidth = 16;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "Hello", format: "plain" },
            { text: "World", format: "plain", space: "join" },
            { text: "Again", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual(["  HelloWorld Again"]);
    });

    test("Should handle join tokens that together exceed line width", () => {
        const consoleWidth = 15;
        const textWidth = 12;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        // ............
        // one 
        // twothreefour 
        // five

        const tokens : FormattedToken[] = [
            { text: "one", format: "plain"},
            { text: "two", format: "plain"},
            { text: "three", format: "plain", space: "join" },
            { text: "four", format: "plain", space: "join" },
            { text: "five", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            " one",
            " twothreefour",
            " five",
        ]);
    });

    test("Should still split long join token if it exceeds line width", () => {
        const consoleWidth = 10;
        const textWidth = 10;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "one", format: "plain"},
            { text: "two", format: "plain"},
            { text: "three", format: "plain", space: "join" },
            { text: "four", format: "plain", space: "join" },
            { text: "five", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        
        expect(aligned).toEqual([
            "one",
            "twothreefo",
            "ur five",
        ]);
    });

    test("Should split long join if joinset goes over multiple lines", () => {
        const consoleWidth = 8;
        const textWidth = 5;
        const textFormatter: TokenFormatter = (token) => token.text;
        const tokenAligner = getTokenAligner(consoleWidth, textWidth, textFormatter);

        const tokens : FormattedToken[] = [
            { text: "one", format: "plain"},
            { text: "two", format: "plain"},
            { text: "three", format: "plain", space: "join" },
            { text: "four", format: "plain", space: "join" },
            { text: "five", format: "plain", space: "join" },
            { text: "six", format: "plain" },
        ];

        const aligned = tokenAligner(tokens);
        expect(aligned).toEqual([
            " one",
            " twoth",
            " reefo",
            " urfiv",
            " e six"
        ]);
    });

});