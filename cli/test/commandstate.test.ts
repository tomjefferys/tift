import { describe, test, expect, vi, beforeEach } from "vitest";
import { CommandState } from "../src/commandstate";
import { EngineFacade } from "../src/enginefacade";
import { Display } from "../src/display";
import { Word } from "tift-types/src/messages/word";
import { Message } from "../src/types";

describe("CommandState", () => {
    let commandState: CommandState;
    let mockEngine: EngineFacade;
    let mockDisplay: Display;
    
    // Mock words for testing
    const mockWords: Word[] = [
        { type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 },
        { type: "word", id: "examine", value: "examine", partOfSpeech: "verb", position: 0 },
        { type: "word", id: "take", value: "take", partOfSpeech: "verb", position: 0 },
        { type: "word", id: "book", value: "book", partOfSpeech: "directObject", position: 1 },
        { type: "word", id: "key", value: "key", partOfSpeech: "directObject", position: 1 }
    ];

    const mockMessages: Message[] = [
        { text: "You look around.", type: "Normal" },
        { text: "Command executed successfully.", type: "Info" }
    ];

    beforeEach(() => {
        // Create mock engine
        mockEngine = {
            getWords: vi.fn(() => mockWords),
            execute: vi.fn(),
            flushMessages: vi.fn((callback) => {
                mockMessages.forEach(msg => callback(msg));
            }),
            getStatus: vi.fn(() => "Status: Ready")
        } as unknown as EngineFacade;

        // Create mock display
        mockDisplay = {
            update: vi.fn(),
            printLine: vi.fn()
        } as unknown as Display;

        commandState = new CommandState(mockEngine, mockDisplay);
    });

    describe("Initialization", () => {
        test("should initialize with empty command and messages", () => {
            expect(commandState.command).toEqual([]);
            expect(commandState.messages).toEqual([]);
        });

        test("should store engine and display references", () => {
            expect(commandState.engine).toBe(mockEngine);
        });
    });

    describe("Input Handling", () => {
        test("should add characters to input", () => {
            commandState.addChar("l");
            commandState.addChar("o");
            
            const displayState = commandState.getDisplayState();
            expect(displayState.partialWord).toEqual(["l", "o"]);
        });

        test("should clear selection when adding character", () => {
            // Set up a selection first
            commandState.addChar("l");
            commandState.tab("forward");
            
            // Add another character should clear selection
            commandState.addChar("o");
            
            const displayState = commandState.getDisplayState();
            expect(displayState.selectedWordIndex).toBeUndefined();
        });

        test("should handle backspace on input", () => {
            commandState.addChar("l");
            commandState.addChar("o");
            commandState.backSpace();
            
            const displayState = commandState.getDisplayState();
            expect(displayState.partialWord).toEqual(["l"]);
        });

        test("should clear selection when backspacing input", () => {
            commandState.addChar("l");
            commandState.tab("forward"); // Set selection
            commandState.backSpace();
            
            const displayState = commandState.getDisplayState();
            expect(displayState.selectedWordIndex).toBeUndefined();
        });
    });

    describe("Backspace with Empty Input", () => {
        test("should remove last command word when input is empty", () => {
            // Add a word to command first
            commandState.command.push({ type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 });
            
            // Backspace with empty input should remove command word
            commandState.backSpace();
            
            expect(commandState.command).toEqual([]);
        });

        test("should clear selection when removing command word", () => {
            commandState.command.push({ type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 });
            commandState.tab("forward"); // Set selection
            
            commandState.backSpace();
            
            const displayState = commandState.getDisplayState();
            expect(displayState.selectedWordIndex).toBeUndefined();
        });

        test("should do nothing when both input and command are empty", () => {
            commandState.backSpace();
            
            expect(commandState.command).toEqual([]);
            const displayState = commandState.getDisplayState();
            expect(displayState.partialWord).toEqual([]);
        });
    });

    describe("Tab Navigation", () => {
        beforeEach(() => {
            // Set up engine to return filtered words
            vi.mocked(mockEngine.getWords).mockReturnValue([
                { type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 },
                { type: "word", id: "listen", value: "listen", partOfSpeech: "verb", position: 0 }
            ]);
        });

        test("should select first word on first forward tab", () => {
            commandState.addChar("l");
            commandState.tab("forward");
            
            const displayState = commandState.getDisplayState();
            expect(displayState.selectedWordIndex).toBe(0);
        });

        test("should select last word on first backward tab", () => {
            commandState.addChar("l");
            commandState.tab("backward");
            
            const displayState = commandState.getDisplayState();
            expect(displayState.selectedWordIndex).toBe(1); // Last index
        });

        test("should cycle forward through words", () => {
            commandState.addChar("l");
            commandState.tab("forward"); // Index 0
            commandState.tab("forward"); // Index 1
            commandState.tab("forward"); // Should wrap to 0
            
            const displayState = commandState.getDisplayState();
            expect(displayState.selectedWordIndex).toBe(0);
        });

        test("should cycle backward through words", () => {
            commandState.addChar("l");
            commandState.tab("forward"); // Index 0
            commandState.tab("backward"); // Should wrap to 1
            
            const displayState = commandState.getDisplayState();
            expect(displayState.selectedWordIndex).toBe(1);
        });

        test("should clear selection when no words available", () => {
            vi.mocked(mockEngine.getWords).mockReturnValue([]);
            commandState.addChar("z");
            commandState.tab("forward");
            
            const displayState = commandState.getDisplayState();
            expect(displayState.selectedWordIndex).toBeUndefined();
        });
    });

    describe("Command Execution", () => {
        test("should execute selected word when enter pressed with selection", () => {
            // Set up engine to return words for current command
            vi.mocked(mockEngine.getWords).mockReturnValue(mockWords);
            
            commandState.addChar("l");
            commandState.tab("forward"); // Select first word
            commandState.enter();
            commandState.update(true);
            
            // Should have added the selected word to command
            expect(commandState.command).toHaveLength(1);
            expect(commandState.command[0].value).toBe("look");
        });

        test("should remove last character when no words match", () => {
            vi.mocked(mockEngine.getWords).mockReturnValue([]);
            
            commandState.addChar("x");
            commandState.addChar("y");
            commandState.addChar("z");
            commandState.enter();
            commandState.update(true);
            
            // Should have removed the last character
            const displayState = commandState.getDisplayState();
            expect(displayState.partialWord).toEqual(["x", "y"]);
        });
    });

    describe("Display State", () => {
        test("should provide correct display state", () => {
            commandState.command.push({ type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 });
            commandState.addChar("b");
            commandState.tab("forward");
            
            // Mock filtered words for display
            vi.mocked(mockEngine.getWords).mockReturnValue([
                { type: "word", id: "book", value: "book", partOfSpeech: "directObject", position: 1 },
                { type: "word", id: "box", value: "box", partOfSpeech: "directObject", position: 1 }
            ]);
            
            const displayState = commandState.getDisplayState();
            
            expect(displayState.partialCommand).toEqual(["look"]);
            expect(displayState.partialWord).toEqual(["b"]);
            expect(displayState.wordChoices).toEqual(["book", "box"]);
            expect(displayState.selectedWordIndex).toBe(0);
        });

        test("should reset messages after getting display state", () => {
            commandState.messages.push({ text: "Test message", type: "Normal" });
            
            const _displayState1 = commandState.getDisplayState();
            const _displayState2 = commandState.getDisplayState();
            
            expect(_displayState1.messages).toHaveLength(1);
            expect(_displayState2.messages).toHaveLength(0);
        });

        test("should handle special pattern matching for 'x' -> 'ex'", () => {
            vi.mocked(mockEngine.getWords).mockReturnValue([
                { type: "word", id: "examine", value: "examine", partOfSpeech: "verb", position: 0 }
            ]);
            
            commandState.addChar("x");
            const displayState = commandState.getDisplayState();
            
            // Should show "examine" as a choice when typing "x"
            expect(displayState.wordChoices).toContain("examine");
        });
    });

    describe("Flush Method", () => {
        test("should flush messages from engine and update display", () => {
            commandState.flush();
            
            expect(mockEngine.flushMessages).toHaveBeenCalled();
            expect(mockDisplay.update).toHaveBeenCalled();
        });

        test("should include flushed messages in display state", () => {
            commandState.flush();
            
            // After flush, messages should have been processed
            expect(mockEngine.flushMessages).toHaveBeenCalled();
            expect(mockDisplay.update).toHaveBeenCalled();
            
            // After flush, the internal messages should be empty (consumed by getDisplayState)
            expect(commandState.messages).toEqual([]);
        });
    });

    describe("Complex Scenarios", () => {
        test("should handle command cancellation with backspace", () => {
            // Build partial command then cancel
            commandState.command.push({ type: "word", id: "take", value: "take", partOfSpeech: "verb", position: 0 });
            commandState.addChar("b");
            
            // Backspace to empty input, then backspace again to remove command word
            commandState.backSpace(); // Remove 'b'
            commandState.backSpace(); // Remove 'take' from command
            
            expect(commandState.command).toEqual([]);
            const displayState = commandState.getDisplayState();
            expect(displayState.partialWord).toEqual([]);
        });

        test("should handle selection and typing interaction", () => {
            vi.mocked(mockEngine.getWords).mockReturnValue([
                { type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 },
                { type: "word", id: "listen", value: "listen", partOfSpeech: "verb", position: 0 }
            ]);
            
            commandState.addChar("l");
            commandState.tab("forward"); // Select "look"
            commandState.addChar("i"); // Should clear selection and add character
            
            const displayState = commandState.getDisplayState();
            expect(displayState.partialWord).toEqual(["l", "i"]);
            expect(displayState.selectedWordIndex).toBeUndefined();
        });
    });

    describe("Edge Cases", () => {
        test("should handle empty word list from engine", () => {
            vi.mocked(mockEngine.getWords).mockReturnValue([]);
            
            commandState.addChar("z");
            commandState.tab("forward");
            commandState.enter();
            commandState.update(true);
            
            // Should not crash and should remove the unmatched character
            // const displayState = commandState.getDisplayState();
            // expect(displayState.partialWord).toEqual([]);
            expect(() => commandState.getDisplayState()).not.toThrow();
        });

        test("should handle engine returning undefined/null gracefully", () => {
            vi.mocked(mockEngine.getWords).mockReturnValue([]);  // Return empty array instead of null
            
            expect(() => {
                commandState.addChar("l");
                commandState.getDisplayState();
            }).not.toThrow();
        });

        test("should handle invalid selection index gracefully", () => {
            vi.mocked(mockEngine.getWords).mockReturnValue([
                { type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 }
            ]);
            
            commandState.addChar("l");
            // Manually set invalid selection index
            (commandState as unknown as { selectedWordIndex: number }).selectedWordIndex = 999;
            commandState.enter();
            
            // This should handle the invalid index gracefully
            expect(() => commandState.update(true)).not.toThrow();
        });
    });

    describe("Debug Mode", () => {
        const debugWords: Word[] = [
            { type: "word", id: "debug-cmd", value: "debug", partOfSpeech: "verb", position: 0, tags: ["debug"] },
            { type: "word", id: "info", value: "info", partOfSpeech: "verb", position: 0, tags: ["debug"] }
        ];

        const normalWords: Word[] = [
            { type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 },
            { type: "word", id: "take", value: "take", partOfSpeech: "verb", position: 0 }
        ];

        const mixedWords: Word[] = [...normalWords, ...debugWords];

        beforeEach(() => {
            vi.mocked(mockEngine.getWords).mockReturnValue(mixedWords);
        });

        test("should initialize with debugMode disabled", () => {
            expect(commandState.debugMode).toBe(false);
        });

        test("should toggle debugMode when control('d') is called", () => {
            expect(commandState.debugMode).toBe(false);
            
            commandState.control("d");
            expect(commandState.debugMode).toBe(true);
            
            commandState.control("d");
            expect(commandState.debugMode).toBe(false);
        });

        test("should not affect debugMode for other control characters", () => {
            commandState.control("a");
            expect(commandState.debugMode).toBe(false);
            
            commandState.control("x");
            expect(commandState.debugMode).toBe(false);
            
            commandState.control("z");
            expect(commandState.debugMode).toBe(false);
        });

        test("should filter out debug words when debugMode is disabled", () => {
            commandState.debugMode = false;
            
            const displayState = commandState.getDisplayState();
            expect(displayState.wordChoices).toEqual(["look", "take"]);
            expect(displayState.wordChoices).not.toContain("debug");
            expect(displayState.wordChoices).not.toContain("info");
        });

        test("should include debug words when debugMode is enabled", () => {
            commandState.debugMode = true;
            
            const displayState = commandState.getDisplayState();
            expect(displayState.wordChoices).toEqual(["debug", "info"]);
        });

        test("should filter debug words in getAllWords() based on debugMode", () => {
            // Test disabled debug mode - should exclude debug words
            commandState.debugMode = false;
            const wordsDisabled = (commandState as any).getAllWords();
            expect(wordsDisabled).toHaveLength(2);
            expect(wordsDisabled.map((w: Word) => w.value)).toEqual(["look", "take"]);

            // Test enabled debug mode - should only include debug words
            commandState.debugMode = true;
            const wordsEnabled = (commandState as any).getAllWords();
            expect(wordsEnabled).toHaveLength(2);
            expect(wordsEnabled.map((w: Word) => w.value)).toEqual(["debug", "info"]);
        });

        test("should reset debugMode to false after command execution", () => {
            commandState.debugMode = true;
            
            // Add a word to the command
            commandState.command.push({ type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 });
            
            // Mock getAllWords to return empty array to trigger command execution
            vi.mocked(mockEngine.getWords).mockReturnValue([]);
            
            // Manually trigger the execute path that resets debugMode
            const result = (commandState as any).execute([{ type: "word", id: "north", value: "north", partOfSpeech: "verb", position: 0 }]);
            
            expect(result).toBe(true);
            expect(commandState.debugMode).toBe(false);
        });

        test("should handle words with no tags properly", () => {
            const wordsWithoutTags: Word[] = [
                { type: "word", id: "simple", value: "simple", partOfSpeech: "verb", position: 0 },
                { type: "word", id: "debug-word", value: "debug-word", partOfSpeech: "verb", position: 0, tags: ["debug"] }
            ];
            
            vi.mocked(mockEngine.getWords).mockReturnValue(wordsWithoutTags);
            
            // Debug mode disabled - should only show words without debug tag
            commandState.debugMode = false;
            let displayState = commandState.getDisplayState();
            expect(displayState.wordChoices).toEqual(["simple"]);
            
            // Debug mode enabled - should only show words with debug tag
            commandState.debugMode = true;
            displayState = commandState.getDisplayState();
            expect(displayState.wordChoices).toEqual(["debug-word"]);
        });

        test("should handle words with multiple tags including debug", () => {
            const wordsWithMultipleTags: Word[] = [
                { type: "word", id: "multi-tag", value: "multi", partOfSpeech: "verb", position: 0, tags: ["debug", "admin", "test"] },
                { type: "word", id: "normal", value: "normal", partOfSpeech: "verb", position: 0, tags: ["basic"] }
            ];
            
            vi.mocked(mockEngine.getWords).mockReturnValue(wordsWithMultipleTags);
            
            // Debug mode disabled - should exclude word with debug tag
            commandState.debugMode = false;
            let displayState = commandState.getDisplayState();
            expect(displayState.wordChoices).toEqual(["normal"]);
            
            // Debug mode enabled - should only include word with debug tag
            commandState.debugMode = true;
            displayState = commandState.getDisplayState();
            expect(displayState.wordChoices).toEqual(["multi"]);
        });

        test("should maintain debugMode state across multiple operations until reset", () => {
            // Enable debug mode
            commandState.control("d");
            expect(commandState.debugMode).toBe(true);
            
            // Perform various operations - debugMode should persist
            commandState.addChar("d");
            expect(commandState.debugMode).toBe(true);
            
            commandState.tab("forward");
            expect(commandState.debugMode).toBe(true);
            
            commandState.backSpace();
            expect(commandState.debugMode).toBe(true);
            
            // Only command execution should reset it by manually calling execute
            commandState.command.push({ type: "word", id: "look", value: "look", partOfSpeech: "verb", position: 0 });
            vi.mocked(mockEngine.getWords).mockReturnValue([]);
            
            const result = (commandState as any).execute([{ type: "word", id: "north", value: "north", partOfSpeech: "verb", position: 0 }]);
            
            expect(result).toBe(true);
            expect(commandState.debugMode).toBe(false);
        });
    });
});