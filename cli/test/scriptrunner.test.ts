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

describe("ScriptRunner", () => {
    let mockEngine : EngineFacade;
    let printed : string[];
    let errored : string[];
    let pendingMessages : Message[];

    beforeEach(() => {
        printed = [];
        errored = [];
        pendingMessages = [];
        mockEngine = {
            getWords : vi.fn(),
            execute : vi.fn(),
            flushMessages : vi.fn((callback : (message : Message) => void) => {
                pendingMessages.forEach(callback);
                pendingMessages = [];
            })
        } as unknown as EngineFacade;
    });

    function runner() {
        return new ScriptRunner(mockEngine, (m) => printed.push(m), (m) => errored.push(m));
    }

    test("'$' lines match against normal words even when a debug word shares the value", async () => {
        // "get" exists as both a normal verb and a debug word; a "$" line should resolve
        // to the normal verb.
        vi.mocked(mockEngine.getWords).mockReturnValue([
            word("verb.get", "get"),
            word("debug.get", "get", ["debug"])
        ]);

        const result = await runner().run(toLines(["$ get"]));

        expect(result).toBe("SUCCESS");
        expect(mockEngine.execute).toHaveBeenCalledWith(["verb.get"]);
    });

    test("'>' lines match against debug-tagged words, even when a normal word shares the value", async () => {
        vi.mocked(mockEngine.getWords).mockReturnValue([
            word("verb.get", "get"),
            word("debug.get", "get", ["debug"])
        ]);

        const result = await runner().run(toLines(["> get"]));

        expect(result).toBe("SUCCESS");
        expect(mockEngine.execute).toHaveBeenCalledWith(["debug.get"]);
    });

    test("'>' lines resolve multi-word developer commands (eg teleport <room>)", async () => {
        vi.mocked(mockEngine.getWords)
            .mockReturnValueOnce([word("debug.teleport", "teleport", ["debug"])])
            .mockReturnValueOnce([word("bar", "bar", ["debug"])]);

        const result = await runner().run(toLines(["> teleport bar"]));

        expect(result).toBe("SUCCESS");
        expect(mockEngine.execute).toHaveBeenCalledWith(["debug.teleport", "bar"]);
    });

    test("'>' lines fail with a ScriptError when no debug word matches", async () => {
        vi.mocked(mockEngine.getWords).mockReturnValue([word("verb.get", "get")]);

        const result = await runner().run(toLines(["> get"]));

        expect(result).toBe("FAILURE");
        expect(errored.some(line => line.includes('Expected command "get"'))).toBe(true);
    });

    test("prints the '>' line before executing, like '$' lines", async () => {
        vi.mocked(mockEngine.getWords).mockReturnValue([word("debug.list", "list", ["debug"])]);

        await runner().run(toLines(["> list"]));

        expect(printed).toContain("> list");
    });
});

describe("isScriptError", () => {
    test("identifies ScriptError instances", () => {
        expect(isScriptError(new ScriptError([], "oops"))).toBe(true);
        expect(isScriptError(new Error("oops"))).toBe(false);
    });
});
