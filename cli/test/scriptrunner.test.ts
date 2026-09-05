import { describe, test, expect, vi, beforeEach } from "vitest";
import { ScriptRunner, isScriptError, ScriptError } from "../src/scriptrunner";
import { EngineFacade } from "../src/enginefacade";
import { Word } from "tift-types/src/messages/word";
import { Message } from "../src/types";

function word(id : string, value : string, tags? : string[]) : Word {
    return { type : "word", id, value, partOfSpeech : "verb", position : 0, ...(tags ? { tags } : {}) };
}

function toLines(lines : string[]) : () => Promise<string | null> {
    const queue = [...lines];
    return async () => queue.length ? queue.shift() as string : null;
}

// Builds a standalone mock EngineFacade with its own message queue, for tests that
// need to distinguish between an "old" engine and the engine a restart swaps in.
function createStandaloneMockEngine(startMessages : Message[] = []) : EngineFacade {
    let pending = [...startMessages];
    return {
        getWords : vi.fn(),
        execute : vi.fn(),
        load : vi.fn(),
        refreshWords : vi.fn(),
        flushMessages : vi.fn((callback : (message : Message) => void) => {
            pending.forEach(callback);
            pending = [];
        })
    } as unknown as EngineFacade;
}

describe("ScriptRunner", () => {
    let mockEngineInstance : EngineFacade;
    let printed : string[];
    let errored : string[];
    let pendingMessages : Message[];

    beforeEach(() => {
        printed = [];
        errored = [];
        pendingMessages = [];
        mockEngineInstance = {
            getWords : vi.fn(),
            execute : vi.fn(),
            load : vi.fn(),
            refreshWords : vi.fn(),
            flushMessages : vi.fn((callback : (message : Message) => void) => {
                pendingMessages.forEach(callback);
                pendingMessages = [];
            })
        } as unknown as EngineFacade;
    });

    function runner(restartEngine? : () => EngineFacade) {
        return new ScriptRunner(mockEngineInstance, (m) => printed.push(m), (m) => errored.push(m), restartEngine);
    }

    test("'$' lines match against normal words even when a debug word shares the value", async () => {
        // "get" exists as both a normal verb and a debug word; a "$" line should resolve
        // to the normal verb.
        vi.mocked(mockEngineInstance.getWords).mockReturnValue([
            word("verb.get", "get"),
            word("debug.get", "get", ["debug"])
        ]);

        const result = await runner().run(toLines(["$ get"]));

        expect(result).toBe("SUCCESS");
        expect(mockEngineInstance.execute).toHaveBeenCalledWith(["verb.get"]);
    });

    test("'>' lines match against debug-tagged words, even when a normal word shares the value", async () => {
        vi.mocked(mockEngineInstance.getWords).mockReturnValue([
            word("verb.get", "get"),
            word("debug.get", "get", ["debug"])
        ]);

        const result = await runner().run(toLines(["> get"]));

        expect(result).toBe("SUCCESS");
        expect(mockEngineInstance.execute).toHaveBeenCalledWith(["debug.get"]);
    });

    test("'$' lines prefer a multi-word value over a shorter word sharing its first word (eg 'get down' vs 'get')", async () => {
        // "get down" (a single, two-word verb, eg getting down off something) must not
        // be shadowed by the unrelated single-word verb "get" just because it happens
        // to match the first word.
        vi.mocked(mockEngineInstance.getWords).mockReturnValue([
            word("verb.get", "get"),
            word("verb.get_down", "get down")
        ]);

        const result = await runner().run(toLines(["$ get down"]));

        expect(result).toBe("SUCCESS");
        expect(mockEngineInstance.execute).toHaveBeenCalledWith(["verb.get_down"]);
    });

    test("'>' lines resolve multi-word developer commands (eg teleport <room>)", async () => {
        vi.mocked(mockEngineInstance.getWords)
            .mockReturnValueOnce([word("debug.teleport", "teleport", ["debug"])])
            .mockReturnValueOnce([word("bar", "bar", ["debug"])]);

        const result = await runner().run(toLines(["> teleport bar"]));

        expect(result).toBe("SUCCESS");
        expect(mockEngineInstance.execute).toHaveBeenCalledWith(["debug.teleport", "bar"]);
    });

    test("'>' lines fail with a ScriptError when no debug word matches", async () => {
        vi.mocked(mockEngineInstance.getWords).mockReturnValue([word("verb.get", "get")]);

        const result = await runner().run(toLines(["> get"]));

        expect(result).toBe("FAILURE");
        expect(errored.some(line => line.includes('Expected command "get"'))).toBe(true);
    });

    test("prints the '>' line before executing, like '$' lines", async () => {
        vi.mocked(mockEngineInstance.getWords).mockReturnValue([word("debug.list", "list", ["debug"])]);

        await runner().run(toLines(["> list"]));

        expect(printed).toContain("> list");
    });

    describe("'---' restart", () => {
        test("fails with a ScriptError when no restart handler is configured", async () => {
            const result = await runner(undefined).run(toLines(["---"]));

            expect(result).toBe("FAILURE");
            expect(errored.some(line => line.includes("restart handler"))).toBe(true);
        });

        test("swaps in the engine returned by the restart handler", async () => {
            const restartedEngine = createStandaloneMockEngine([{ type : "Normal", text : "Fresh Room", blocks : [] }]);
            const restartEngine = vi.fn(() => restartedEngine);

            const result = await runner(restartEngine).run(toLines(["---", "Fresh Room"]));

            expect(result).toBe("SUCCESS");
            expect(restartEngine).toHaveBeenCalledTimes(1);
        });

        test("later commands run against the restarted engine, not the original one", async () => {
            const restartedEngine = createStandaloneMockEngine();
            vi.mocked(restartedEngine.getWords).mockReturnValue([word("verb.wait", "wait")]);
            const restartEngine = vi.fn(() => restartedEngine);

            const result = await runner(restartEngine).run(toLines(["---", "$ wait"]));

            expect(result).toBe("SUCCESS");
            expect(restartedEngine.execute).toHaveBeenCalledWith(["verb.wait"]);
            expect(mockEngineInstance.execute).not.toHaveBeenCalled();
        });

        test("a trailing label other than 'sandbox' is ignored and doesn't enter a sandbox room", async () => {
            const restartedEngine = createStandaloneMockEngine();
            const restartEngine = vi.fn(() => restartedEngine);

            const result = await runner(restartEngine).run(toLines(["--- test 2: trunk"]));

            expect(result).toBe("SUCCESS");
            expect(restartedEngine.load).not.toHaveBeenCalled();
        });
    });

    describe("'--- sandbox'", () => {
        test("loads an empty sandbox room and teleports the player into it", async () => {
            const restartedEngine = createStandaloneMockEngine();
            vi.mocked(restartedEngine.getWords)
                .mockReturnValueOnce([word("debug.teleport", "teleport", ["debug"])])
                .mockReturnValueOnce([word("__sandbox__", "__sandbox__", ["debug"])]);
            const restartEngine = vi.fn(() => restartedEngine);

            const result = await runner(restartEngine).run(toLines(["--- sandbox"]));

            expect(result).toBe("SUCCESS");
            expect(restartedEngine.load).toHaveBeenCalledWith(expect.stringContaining("__sandbox__"));
            expect(restartedEngine.execute).toHaveBeenCalledWith(["debug.teleport", "__sandbox__"]);
        });

        test("the teleport into the sandbox isn't printed, unlike an explicit '>' command", async () => {
            const restartedEngine = createStandaloneMockEngine();
            vi.mocked(restartedEngine.getWords)
                .mockReturnValueOnce([word("debug.teleport", "teleport", ["debug"])])
                .mockReturnValueOnce([word("__sandbox__", "__sandbox__", ["debug"])]);
            // The first flushMessages() call is restart()'s own (prints, but nothing is
            // queued yet); the second is enterSandbox()'s suppressed flush, which is
            // where the teleport's log message actually arrives.
            vi.mocked(restartedEngine.flushMessages)
                .mockImplementationOnce(() => { /* nothing queued yet */ })
                .mockImplementationOnce((callback) => callback(
                    { type : "Normal", text : "Player teleported to location __sandbox__.", blocks : [] }
                ));
            const restartEngine = vi.fn(() => restartedEngine);

            await runner(restartEngine).run(toLines(["--- sandbox"]));

            expect(printed.some(line => line.includes("Player teleported"))).toBe(false);
        });
    });

    describe("'@item' directive", () => {
        // matchCommand's recursion makes one trailing "wasted" getWords() call after the
        // last word of a command matches (its result is discarded once the command is
        // fully consumed) - so a 2-word command like "get trunk" needs 3 queued
        // responses, not 2, before the next command's mocks can line up correctly.
        test("stages an item into the current location via developer get then drop", async () => {
            vi.mocked(mockEngineInstance.getWords)
                .mockReturnValueOnce([word("debug.get", "get", ["debug"])])
                .mockReturnValueOnce([word("trunk", "trunk", ["debug"])])
                .mockReturnValueOnce([]) // trailing wasted call, see comment above
                .mockReturnValueOnce([word("debug.drop", "drop", ["debug"])])
                .mockReturnValueOnce([word("trunk", "trunk", ["debug"])]);

            const result = await runner().run(toLines(["@item trunk"]));

            expect(result).toBe("SUCCESS");
            expect(mockEngineInstance.execute).toHaveBeenNthCalledWith(1, ["debug.get", "trunk"]);
            expect(mockEngineInstance.execute).toHaveBeenNthCalledWith(2, ["debug.drop", "trunk"]);
        });

        test("the get/drop staging isn't printed, unlike an explicit '>' command", async () => {
            // run()'s own startup flush happens first (and must stay empty); the get/drop
            // log messages only arrive on stageItem()'s later, suppressed flush.
            vi.mocked(mockEngineInstance.flushMessages)
                .mockImplementationOnce(() => { /* run()'s startup flush: nothing queued yet */ })
                .mockImplementationOnce((callback) => {
                    callback({ type : "Normal", text : "Item trunk added to player inventory.", blocks : [] });
                    callback({ type : "Normal", text : "Item trunk dropped in current location.", blocks : [] });
                });
            vi.mocked(mockEngineInstance.getWords)
                .mockReturnValueOnce([word("debug.get", "get", ["debug"])])
                .mockReturnValueOnce([word("trunk", "trunk", ["debug"])])
                .mockReturnValueOnce([]) // trailing wasted call, see comment above
                .mockReturnValueOnce([word("debug.drop", "drop", ["debug"])])
                .mockReturnValueOnce([word("trunk", "trunk", ["debug"])]);

            await runner().run(toLines(["@item trunk"]));

            expect(printed.some(line => line.includes("Item trunk"))).toBe(false);
        });

        test("fails with a ScriptError when the item id is missing", async () => {
            const result = await runner().run(toLines(["@item"]));

            expect(result).toBe("FAILURE");
            expect(errored.some(line => line.includes('"@item" requires exactly one item id'))).toBe(true);
        });

        test("fails with a ScriptError for an unknown directive", async () => {
            const result = await runner().run(toLines(["@teleport bar"]));

            expect(result).toBe("FAILURE");
            expect(errored.some(line => line.includes("Unknown directive"))).toBe(true);
        });
    });

    describe("'!$' negative command", () => {
        test("passes, and doesn't execute anything, when the command can't be built", async () => {
            vi.mocked(mockEngineInstance.getWords).mockReturnValue([word("verb.get", "get")]);

            const result = await runner().run(toLines(["!$ get candle"]));

            expect(result).toBe("SUCCESS");
            expect(mockEngineInstance.execute).not.toHaveBeenCalled();
        });

        test("fails, and doesn't execute anything, when the command can be built", async () => {
            vi.mocked(mockEngineInstance.getWords)
                .mockReturnValueOnce([word("verb.get", "get")])
                .mockReturnValueOnce([word("candle", "candle")]);

            const result = await runner().run(toLines(["!$ get candle"]));

            expect(result).toBe("FAILURE");
            expect(errored.some(line => line.includes('Command unexpectedly available: "get candle"'))).toBe(true);
            expect(mockEngineInstance.execute).not.toHaveBeenCalled();
        });

        test("prints the line before checking it, like '$' lines", async () => {
            vi.mocked(mockEngineInstance.getWords).mockReturnValue([word("verb.get", "get")]);

            await runner().run(toLines(["!$ get candle"]));

            expect(printed).toContain("!$ get candle");
        });

        test("resets the engine's word cache after a partial match, so the next line matches from the top level", async () => {
            // "get" resolves, but "candle" doesn't - matchCommand() advances (and caches)
            // one word at a time, so this leaves the engine's word cache pointing at the
            // "get" partial rather than the top level unless something resets it.
            vi.mocked(mockEngineInstance.getWords)
                .mockReturnValueOnce([word("verb.get", "get")])
                .mockReturnValueOnce([word("mop", "mop")]);

            const result = await runner().run(toLines(["!$ get candle"]));

            expect(result).toBe("SUCCESS");
            expect(mockEngineInstance.refreshWords).toHaveBeenCalled();
        });

        test("resets the engine's word cache even when the command fully resolves (and the line fails)", async () => {
            vi.mocked(mockEngineInstance.getWords)
                .mockReturnValueOnce([word("verb.get", "get")])
                .mockReturnValueOnce([word("candle", "candle")]);

            await runner().run(toLines(["!$ get candle"]));

            expect(mockEngineInstance.refreshWords).toHaveBeenCalled();
        });
    });

    describe("fail-fast per test section", () => {
        test("skips the rest of a failed section but resumes normally after the next '---'", async () => {
            const restartedEngine = createStandaloneMockEngine();
            vi.mocked(restartedEngine.getWords).mockReturnValue([word("verb.wait", "wait")]);
            const restartEngine = vi.fn(() => restartedEngine);

            // Section 1: the first line fails (messages start empty, so this assertion
            // can never match); the "$ wait" line after it must be skipped rather than
            // run - if it ran, mockEngineInstance.getWords (unconfigured here) would be
            // hit. Section 2 (after "---") should run normally regardless.
            const result = await runner(restartEngine).run(toLines([
                "nonexistent output",
                "$ wait",
                "---",
                "$ wait"
            ]));

            expect(result).toBe("FAILURE");
            expect(mockEngineInstance.execute).not.toHaveBeenCalled();
            expect(restartedEngine.execute).toHaveBeenCalledWith(["verb.wait"]);
        });
    });

    describe("test summary", () => {
        test("reports each section as pass/fail, labelled by its '---' text or index, plus a tally", async () => {
            const restartedEngine = createStandaloneMockEngine();
            const restartEngine = vi.fn(() => restartedEngine);

            // "!nope" passes trivially (message buffer starts empty on each section, so
            // it never contains "nope"), giving each section a passing line to run
            // before section 2's second line fails.
            const result = await runner(restartEngine).run(toLines([
                "!nope",
                "--- second section: labelled",
                "!nope",
                "expected but missing"
            ]));

            expect(result).toBe("FAILURE");
            expect(errored.some(line => line.includes("Test summary:"))).toBe(true);
            expect(errored.some(line => line.includes("Test 1"))).toBe(true);
            expect(errored.some(line => line.includes("second section: labelled"))).toBe(true);
            expect(errored.some(line => line.includes("1 passed, 1 failed"))).toBe(true);
        });

        test("reports an all-passed tally when every section succeeds", async () => {
            const result = await runner().run(toLines(["!nope"]));

            expect(result).toBe("SUCCESS");
            expect(errored.some(line => line.includes("All 1 test passed"))).toBe(true);
        });

        test("prints no summary at all when the script has no test content", async () => {
            const result = await runner().run(toLines(["# just a comment"]));

            expect(result).toBe("SUCCESS");
            expect(errored.some(line => line.includes("Test summary:"))).toBe(false);
        });
    });
});

describe("isScriptError", () => {
    test("identifies ScriptError instances", () => {
        expect(isScriptError(new ScriptError([], "oops"))).toBe(true);
        expect(isScriptError(new Error("oops"))).toBe(false);
    });
});
