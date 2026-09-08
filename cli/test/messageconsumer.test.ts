import { describe, test, expect } from "vitest";
import { MessageConsumer } from "../src/messageconsumer";

describe("MessageConsumer", () => {
    test("maps a 'Log' message's level to the matching Message type", () => {
        const consumer = new MessageConsumer();

        consumer.consume({ type : "Log", level : "error", message : "boom" });
        consumer.consume({ type : "Log", level : "warn", message : "careful" });
        consumer.consume({ type : "Log", level : "info", message : "fyi" });

        expect(consumer.printMessages.map(m => m.type)).toEqual(["Error", "Warning", "Info"]);
    });

    test("records the most recent error-level 'Log' message as lastErrorMessage", () => {
        const consumer = new MessageConsumer();

        expect(consumer.lastErrorMessage).toBeUndefined();

        consumer.consume({ type : "Log", level : "info", message : "fyi" });
        expect(consumer.lastErrorMessage).toBeUndefined();

        consumer.consume({ type : "Log", level : "error", message : "Compilation failed: bad.yaml:3" });
        expect(consumer.lastErrorMessage).toBe("Compilation failed: bad.yaml:3");
    });
});
