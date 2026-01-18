import { Properties } from "tift-types/src/messages/output";
import { createSimpleOption } from "./util";
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import * as ReactUtils from "./reactutils";
import { Input } from "tift-engine"

const TIFT_BOOKMARK = "TIFT_BOOKMARK";

export interface BookmarkManager {
    setBookmark(data : string) : Promise<boolean>;
    getBookmark() : Promise<string | null>;
}

export function createBookmarkManager(gameInfo : Properties) : BookmarkManager {
    const gameId = gameInfo["gameId"];
    return {
        setBookmark : async (data : string) => {
            try {
                await window.navigator.storage.persist();
                const key = `${TIFT_BOOKMARK}_${gameId}`;
                window.localStorage.setItem(key, data);
                return true;
            } catch {
                return false;
            }
        },
        getBookmark : async () => {
            try {
                const key = `${TIFT_BOOKMARK}_${gameId}`;
                const data = window.localStorage.getItem(key);
                return data;
            } catch {
                return null;
            }
        }
    }
} 

export function createSaveOption(bookmarkManagerRef : React.RefObject<BookmarkManager | null>,
                                 bookmarkRef : React.MutableRefObject<string | null>) {
    return createSimpleOption( "bookmark", async (forwarder : DecoratedForwarder) => {
        if (!bookmarkManagerRef.current) {
            forwarder.warn("Bookmarking not available.");
            return;
        }
        const bookmarkPromise = ReactUtils.createRefChangePromise(bookmarkRef);
        await forwarder.send(Input.save((true)));
        const success = await bookmarkPromise;
        if (success && bookmarkRef.current) {
            try {
                const compressedData = await ReactUtils.compressAndEncode(bookmarkRef.current);
                forwarder.print("Game bookmarked.");
                bookmarkManagerRef.current?.setBookmark(compressedData);
            } catch (e) {
                forwarder.warn("Failed to compress bookmark data.");
            }
        } else {
            forwarder.warn("Failed to bookmark game.");
        }
        bookmarkRef.current = null;
    });
}

export function createLoadOption(bookmarkManagerRef : React.RefObject<BookmarkManager | null>,
                                 loadGame : (gameData : string, forwarder : DecoratedForwarder) => Promise<void>) {
    return createSimpleOption( "load bookmark", async (forwarder : DecoratedForwarder) => {
        if (!bookmarkManagerRef.current) {
          forwarder.warn("Bookmarking not available.");
          return;
        }
        const bookmarkData = await bookmarkManagerRef.current.getBookmark();
        if (bookmarkData) {
            forwarder.print("Loading bookmarked game...");
            try {
                const decompressedData = await ReactUtils.decodeAndDecompress(bookmarkData);
                await loadGame(decompressedData, forwarder);
                forwarder.print("Bookmarked game loaded.");
            } catch (e) {
                forwarder.warn("Failed to load bookmarked game.");
            }
        } else {
            forwarder.warn("No bookmarked game found.");
        }
    });
}