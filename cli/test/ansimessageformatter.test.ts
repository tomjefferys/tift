import { ANSI_MESSAGE_FORMATTER } from "../src/ansimessageforamtter";
import { Message } from "../src/message";

describe("ANSI_MESSAGE_FORMATTER", () => {

    test("should format Normal messages with markdown", () => {
        const message: Message = { type: "Normal", text: "This is **bold**, *italic*, and ***bold italic***." };
        const formatted = ANSI_MESSAGE_FORMATTER(message);
        expect(formatted).toBe(`This is ${"\u001b[1mbold\u001b[22m"}, ${"\u001b[3mitalic\u001b[23m"}, and ${"\u001b[1m\u001b[3mbold italic\u001b[23m\u001b[22m"}.`);
    });

    test("should format Command messages in green", () => {
        const message: Message = { type: "Command", text: "Run command" };
        const formatted = ANSI_MESSAGE_FORMATTER(message);
        expect(formatted).toBe(`\u001b[32mRun command\u001b[39m`);
    });
    
    test("Should format multiple bold styles in Normal messages", () => {
        const message: Message = { type: "Normal", text: "This is **bold** and this is also **bold**." };
        const formatted = ANSI_MESSAGE_FORMATTER(message);
        expect(formatted).toBe(`This is ${"\u001b[1mbold\u001b[22m"} and this is also ${"\u001b[1mbold\u001b[22m"}.`);
    });

    test("should format Info messages in blue", () => {
        const message: Message = { type: "Info", text: "Information" };
        const formatted = ANSI_MESSAGE_FORMATTER(message);
        expect(formatted).toBe(`\u001b[34mInformation\u001b[39m`);
    });

    test("should format Warning messages in yellow", () => {
        const message: Message = { type: "Warning", text: "Warning!" };
        const formatted = ANSI_MESSAGE_FORMATTER(message);
        expect(formatted).toBe(`\u001b[33mWarning!\u001b[39m`);
    });

    test("should format Error messages in red bold", () => {
        const message: Message = { type: "Error", text: "Error occurred" };
        const formatted = ANSI_MESSAGE_FORMATTER(message);
        expect(formatted).toBe(`\u001b[31m\u001b[1mError occurred\u001b[22m\u001b[39m`);
    });
});