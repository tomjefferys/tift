import { describe, test, expect, vi, beforeEach } from "vitest";
import { KeypressHandler, InputHandler, KeypressHandlerDependencies } from "../src/keypresshandler";
import { Key } from 'readline';

describe("KeypressHandler", () => {
    let mockGameState: InputHandler;
    let mockControlState: InputHandler;
    let mockDependencies: KeypressHandlerDependencies;
    let keypressHandler: KeypressHandler;

    beforeEach(() => {
        // Create mock input handlers
        mockGameState = {
            addChar: vi.fn(),
            backSpace: vi.fn(),
            enter: vi.fn(),
            update: vi.fn()
        };

        mockControlState = {
            addChar: vi.fn(),
            backSpace: vi.fn(),
            enter: vi.fn(),
            update: vi.fn()
        };

        // Create mock dependencies
        mockDependencies = {
            getGameState: vi.fn(() => mockGameState),
            getControlState: vi.fn(() => mockControlState),
            onQuit: vi.fn()
        };

        keypressHandler = new KeypressHandler(mockDependencies);
    });

    describe("Mode Management", () => {
        test("should start in GAME mode", () => {
            expect(keypressHandler.getCurrentMode()).toBe("GAME");
        });

        test("should allow setting mode", () => {
            keypressHandler.setMode("CONTROL");
            expect(keypressHandler.getCurrentMode()).toBe("CONTROL");
            
            keypressHandler.setMode("GAME");
            expect(keypressHandler.getCurrentMode()).toBe("GAME");
        });

        test("should toggle mode on tab press", () => {
            const tabEvent: Key = { name: "tab", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", tabEvent);
            expect(keypressHandler.getCurrentMode()).toBe("CONTROL");

            keypressHandler.handleKeypress("", tabEvent);
            expect(keypressHandler.getCurrentMode()).toBe("GAME");
        });
    });

    describe("Character Input", () => {
        test("should handle letter input in GAME mode", () => {
            const event: Key = { name: "a", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("a", event);
            
            expect(mockDependencies.getGameState).toHaveBeenCalled();
            expect(mockGameState.addChar).toHaveBeenCalledWith("a");
            expect(mockGameState.update).toHaveBeenCalled();
        });

        test("should handle letter input in CONTROL mode", () => {
            keypressHandler.setMode("CONTROL");
            const event: Key = { name: "b", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("b", event);
            
            expect(mockDependencies.getControlState).toHaveBeenCalled();
            expect(mockControlState.addChar).toHaveBeenCalledWith("b");
            expect(mockControlState.update).toHaveBeenCalled();
        });

        test("should handle uppercase letters", () => {
            const event: Key = { name: "A", ctrl: false, meta: false, shift: true };
            
            keypressHandler.handleKeypress("A", event);
            
            expect(mockGameState.addChar).toHaveBeenCalledWith("A");
            expect(mockGameState.update).toHaveBeenCalled();
        });

        test("should handle space character", () => {
            const event: Key = { name: "space", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress(" ", event);
            
            expect(mockGameState.addChar).toHaveBeenCalledWith(" ");
            expect(mockGameState.update).toHaveBeenCalled();
        });

        test("should ignore non-letter characters", () => {
            const event: Key = { name: "1", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("1", event);
            
            expect(mockGameState.addChar).not.toHaveBeenCalled();
            expect(mockGameState.update).toHaveBeenCalled();
        });

        test("should ignore special characters", () => {
            const event: Key = { name: "!", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("!", event);
            
            expect(mockGameState.addChar).not.toHaveBeenCalled();
            expect(mockGameState.update).toHaveBeenCalled();
        });
    });

    describe("Special Key Handling", () => {
        test("should handle return key", () => {
            const event: Key = { name: "return", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", event);
            
            expect(mockGameState.enter).toHaveBeenCalled();
            expect(mockGameState.update).toHaveBeenCalled();
        });

        test("should handle backspace key", () => {
            const event: Key = { name: "backspace", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", event);
            
            expect(mockGameState.backSpace).toHaveBeenCalled();
            expect(mockGameState.update).toHaveBeenCalled();
        });

        test("should handle Ctrl+C for quit", () => {
            const event: Key = { name: "c", ctrl: true, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", event);
            
            expect(mockDependencies.onQuit).toHaveBeenCalled();
            // Should not call update since it returns early
            expect(mockGameState.update).not.toHaveBeenCalled();
        });

        test("should handle regular 'c' character (not Ctrl+C)", () => {
            const event: Key = { name: "c", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("c", event);
            
            expect(mockDependencies.onQuit).not.toHaveBeenCalled();
            expect(mockGameState.addChar).toHaveBeenCalledWith("c");
            expect(mockGameState.update).toHaveBeenCalled();
        });
    });

    describe("Mode Switching with Tab", () => {
        test("should switch from GAME to CONTROL and call correct state", () => {
            const tabEvent: Key = { name: "tab", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", tabEvent);
            
            expect(keypressHandler.getCurrentMode()).toBe("CONTROL");
            expect(mockControlState.update).toHaveBeenCalled();
        });

        test("should switch from CONTROL to GAME and call correct state", () => {
            keypressHandler.setMode("CONTROL");
            const tabEvent: Key = { name: "tab", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", tabEvent);
            
            expect(keypressHandler.getCurrentMode()).toBe("GAME");
            expect(mockGameState.update).toHaveBeenCalled();
        });
    });

    describe("State Selection", () => {
        test("should use game state when in GAME mode", () => {
            keypressHandler.setMode("GAME");
            const event: Key = { name: "return", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", event);
            
            expect(mockDependencies.getGameState).toHaveBeenCalled();
            expect(mockDependencies.getControlState).not.toHaveBeenCalled();
            expect(mockGameState.enter).toHaveBeenCalled();
        });

        test("should use control state when in CONTROL mode", () => {
            keypressHandler.setMode("CONTROL");
            const event: Key = { name: "return", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", event);
            
            expect(mockDependencies.getControlState).toHaveBeenCalled();
            expect(mockDependencies.getGameState).not.toHaveBeenCalled();
            expect(mockControlState.enter).toHaveBeenCalled();
        });
    });

    describe("Edge Cases", () => {
        test("should handle null/undefined char with valid event", () => {
            const event: Key = { name: "return", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", event);
            
            expect(mockGameState.enter).toHaveBeenCalled();
            expect(mockGameState.update).toHaveBeenCalled();
        });

        test("should handle unknown key events", () => {
            const event: Key = { name: "unknown", ctrl: false, meta: false, shift: false };
            
            keypressHandler.handleKeypress("", event);
            
            // Should still call update even for unknown keys
            expect(mockGameState.update).toHaveBeenCalled();
            expect(mockGameState.addChar).not.toHaveBeenCalled();
            expect(mockGameState.enter).not.toHaveBeenCalled();
            expect(mockGameState.backSpace).not.toHaveBeenCalled();
        });

        test("should handle mixed case characters", () => {
            const events = [
                { char: "H", event: { name: "h", ctrl: false, meta: false, shift: true } },
                { char: "e", event: { name: "e", ctrl: false, meta: false, shift: false } },
                { char: "L", event: { name: "l", ctrl: false, meta: false, shift: true } },
                { char: "o", event: { name: "o", ctrl: false, meta: false, shift: false } },
            ];
            
            events.forEach(({ char, event }) => {
                keypressHandler.handleKeypress(char, event as Key);
            });
            
            expect(mockGameState.addChar).toHaveBeenCalledWith("H");
            expect(mockGameState.addChar).toHaveBeenCalledWith("e");
            expect(mockGameState.addChar).toHaveBeenCalledWith("L");
            expect(mockGameState.addChar).toHaveBeenCalledWith("o");
            expect(mockGameState.addChar).toHaveBeenCalledTimes(4);
        });
    });

    describe("Complex Scenarios", () => {
        test("should handle typing in different modes", () => {
            // Type in GAME mode
            keypressHandler.handleKeypress("h", { name: "h", ctrl: false, meta: false, shift: false });
            keypressHandler.handleKeypress("i", { name: "i", ctrl: false, meta: false, shift: false });
            
            // Switch to CONTROL mode
            keypressHandler.handleKeypress("", { name: "tab", ctrl: false, meta: false, shift: false });
            
            // Type in CONTROL mode
            keypressHandler.handleKeypress("q", { name: "q", ctrl: false, meta: false, shift: false });
            keypressHandler.handleKeypress("u", { name: "u", ctrl: false, meta: false, shift: false });
            
            // Verify game state calls
            expect(mockGameState.addChar).toHaveBeenCalledWith("h");
            expect(mockGameState.addChar).toHaveBeenCalledWith("i");
            expect(mockGameState.addChar).toHaveBeenCalledTimes(2);
            
            // Verify control state calls
            expect(mockControlState.addChar).toHaveBeenCalledWith("q");
            expect(mockControlState.addChar).toHaveBeenCalledWith("u");
            expect(mockControlState.addChar).toHaveBeenCalledTimes(2);
            
            // Verify mode switch occurred
            expect(keypressHandler.getCurrentMode()).toBe("CONTROL");
        });

        test("should handle enter and backspace in different modes", () => {
            // Actions in GAME mode
            keypressHandler.handleKeypress("", { name: "return", ctrl: false, meta: false, shift: false });
            keypressHandler.handleKeypress("", { name: "backspace", ctrl: false, meta: false, shift: false });
            
            // Switch to CONTROL mode
            keypressHandler.handleKeypress("", { name: "tab", ctrl: false, meta: false, shift: false });
            
            // Actions in CONTROL mode
            keypressHandler.handleKeypress("", { name: "return", ctrl: false, meta: false, shift: false });
            keypressHandler.handleKeypress("", { name: "backspace", ctrl: false, meta: false, shift: false });
            
            // Verify game state calls
            expect(mockGameState.enter).toHaveBeenCalledTimes(1);
            expect(mockGameState.backSpace).toHaveBeenCalledTimes(1);
            
            // Verify control state calls  
            expect(mockControlState.enter).toHaveBeenCalledTimes(1);
            expect(mockControlState.backSpace).toHaveBeenCalledTimes(1);
        });
    });
});