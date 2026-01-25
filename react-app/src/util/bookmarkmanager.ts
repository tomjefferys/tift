import { Properties, StatusType } from "tift-types/src/messages/output";
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import * as ReactUtils from "./reactutils";
import { Input } from "tift-engine"
import { StateMachine } from "tift-types/src/util/statemachine";
import { word, createStateMachine, handleInput } from "tift-engine"
import { InputMessage } from 'tift-types/src/messages/input';
import { Word } from "tift-types/src/messages/word";
import { Optional } from "tift-types/src/util/optional";

const MAX_BOOKMARKS = 10;

const TIFT_BOOKMARKS = "TIFT_BOOKMARKS";

const SAVE_FILE_PREFIX = "tift-bookmark-";
const SAVE_FILE_EXTENSION = ".tiftbk";

const enum BOOKMARK_MANAGER_STATES {
    PROMPT = "prompt",
    BOOKMARK_SELECTED = "bookmark-selected",
    TERMINATE = "__TERMINATE__",
}

type BookmarkManagerState = `${BOOKMARK_MANAGER_STATES}`;

const enum OPTIONS {
    NEW = "new",
    CANCEL = "cancel",
    LOAD = "load",
    DELETE = "delete",
}

const enum BOOKMARK_ACTIONS {
    LOAD = "load",
    DELETE = "delete",
    SELECT = "select",
    EXPORT = "export",
    CANCEL = "cancel",
}

const SELECTED_BOOKMARK_OPTIONS = [ 
    word(BOOKMARK_ACTIONS.LOAD, BOOKMARK_ACTIONS.LOAD, "select"),
    word(BOOKMARK_ACTIONS.DELETE, BOOKMARK_ACTIONS.DELETE, "select"),
    word(BOOKMARK_ACTIONS.EXPORT, BOOKMARK_ACTIONS.EXPORT, "select"),
    word(BOOKMARK_ACTIONS.CANCEL, BOOKMARK_ACTIONS.CANCEL, "select")
];
interface Bookmark {
    gameId : string;
    name : string;
    data : string;
}

type BookmarkList = Bookmark[];

type GameLoader = (gameData : string, forwarder : DecoratedForwarder) => Promise<void>;

interface BookmarkOptions {
    bookmarks : BookmarkList;
    selectOptions : Word[];
    extraOptions : Word[];
    allOptions : Word[];
}

/**
 * Creates the bookmark manager options state machine
 * @param bookmarkRef Reference to bookmark data
 * @param gameLoader Function to load game from bookmark data
 * @returns The bookmark manager state machine
 */
export function createBookmarkManagerOptions(
        bookmarkRef : React.MutableRefObject<string | null>,
        statusRef : React.RefObject<StatusType>,
        infoRef : React.RefObject<Properties>,
        gameLoader : GameLoader) : StateMachine<InputMessage, DecoratedForwarder> {

    console.log("Creating bookmark manager for gameId: " + infoRef.current?.gameId);

    // Get the gameId from infoRef
    const getGameId = () : string => {
        if (!infoRef.current || !infoRef.current.gameId) {
            throw new Error("Cannot get gameId: game info unknown.");
        }
        return infoRef.current.gameId;
    }

    // Get the bookmark key for local storage
    const getBookmarksKey = () : string => {
        const gameId = getGameId();
        return TIFT_BOOKMARKS + "_" + gameId;
    }

    // Get the list of bookmarks from local storage
    const getBookmarkList = () : BookmarkList => {
        const bookmarkKey = getBookmarksKey();
        const data = window.localStorage.getItem(bookmarkKey);
        if (data) {
            return JSON.parse(data) as BookmarkList;
        }
        return [];
    }

    // Save the bookmark list to local storage
    const saveBookmarkList = (bookmarks : BookmarkList) : void => {
        const bookmarksKey = getBookmarksKey();
        const data = JSON.stringify(bookmarks);
        window.localStorage.setItem(bookmarksKey, data);
    }

    // Add a new bookmark, return false if max bookmarks reached
    const addBookmark = (name : string, data : string) : void => {
        const gameId = getGameId();
        const bookmarks = getBookmarkList();
        if (bookmarks.length >= MAX_BOOKMARKS) {
            throw new Error("Maximum number of bookmarks reached. Cannot create new bookmark.");
        }
        bookmarks.push({ gameId, name, data });
        saveBookmarkList(bookmarks);
    }

    // Remove a bookmark by index
    const removeBookmark = (index : number) : void => {
        const bookmarks = getBookmarkList();
        if (index < 0 || index >= bookmarks.length) {
            throw new Error("Invalid bookmark index. Cannot remove bookmark.");
        }   
        bookmarks.splice(index, 1);
        saveBookmarkList(bookmarks);
    }

    const exportBookmark = async (selectedBookmark : number, forwarder : DecoratedForwarder) : Promise<void> => {
        const bookmarks = getBookmarkList();
        if (selectedBookmark < 0 || selectedBookmark >= bookmarks.length) {
            throw new Error("Invalid bookmark selected for export.");
        }
        try {
            const bookmark = bookmarks[selectedBookmark];
            const filename = `${SAVE_FILE_PREFIX}${bookmark.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${SAVE_FILE_EXTENSION}`;
            ReactUtils.downloadTextFile(filename, JSON.stringify(bookmark));
        } catch (e) {
            throw new Error("Failed to export bookmark data.", { cause : e });
        }
    }    
    
    // Get bookmark options for state machine
    const getBookmarkOptions = () : BookmarkOptions => {
        const bookmarks = getBookmarkList();
        const selectOptions = bookmarks.map((bookmark, index) => word(BOOKMARK_ACTIONS.SELECT + "_" + index.toString(), bookmark.name, "select"));
        const extraOptions = [word(OPTIONS.CANCEL, OPTIONS.CANCEL, "select"), word(OPTIONS.NEW, "new bookmark", "select")];
        const allOptions = [...selectOptions, ...extraOptions];
        return {
            bookmarks,
            selectOptions,
            extraOptions,
            allOptions
        };
    }

    // Load game from bookmark
    const loadGameFromBookmark = async (bookmarkIndex : number, forwarder : DecoratedForwarder) : Promise<void> => {
        const bookmarkList = getBookmarkList();
        if (bookmarkIndex < 0 || bookmarkIndex >= bookmarkList.length) {
            throw new Error("Invalid bookmark selected.");
        }
        const bookmark = bookmarkList[bookmarkIndex];
        try {
            const decompressedData = await ReactUtils.decodeAndDecompress(bookmark.data); 
            return gameLoader(decompressedData, forwarder);
        } catch (e) {
            throw new Error("Failed to decompress bookmark data.", { cause : e });
        }
    }

    // Get latest bookmark data by sending save command and waiting for bookmarkRef to be updated
    const getBookmarkData = async (forwarder : DecoratedForwarder) : Promise<string> => {
        const bookmarkPromise = ReactUtils.createRefChangePromise(bookmarkRef);
        await forwarder.send(Input.save((true)));
        const success = await bookmarkPromise;
        if (success && bookmarkRef.current) {
            try {
                const compressedData = await ReactUtils.compressAndEncode(bookmarkRef.current);
                bookmarkRef.current = null;
                return compressedData;
            } finally {
                bookmarkRef.current = null;
            }
        } else {
            throw new Error("Failed to bookmark game.");
        }
    }

    const generateBookmarkName = () : string => {
        if (!statusRef.current) {
            throw new Error("Cannot create bookmark: game status unknown.");
        }
        const status = statusRef.current;
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit' });
        return `${status.title} - ${dateStr} ${timeStr}`;
    }

    let selectedBookmark = -1;

    return createStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            selectedBookmark = 0;
            const { allOptions } = getBookmarkOptions();
            forwarder.words([], allOptions);
        },
        onAction : async (input : InputMessage, forwarder : DecoratedForwarder) => {
            const { bookmarks, selectOptions, allOptions } = getBookmarkOptions();
            let nextState : Optional<BookmarkManagerState> = undefined;
            const handler = handleInput(input);
            selectOptions.forEach(async (option, index) => {
                await handler.onCommand([option.id], async () => {
                    const bookmark = bookmarks[index];
                    forwarder.print(`Selecting bookmark: ${bookmark.name}`);
                    selectedBookmark = index;
                    nextState = BOOKMARK_MANAGER_STATES.BOOKMARK_SELECTED;
                });
            });
            await handler.onCommand([OPTIONS.CANCEL], async () => {
                forwarder.print("cancelled");
                nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
            });
            await handler.onCommand([OPTIONS.NEW], async () => {
                try {
                    forwarder.print("Creating new bookmark...");
                    const name = generateBookmarkName();
                    const bookmarkData = await getBookmarkData(forwarder);
                    addBookmark(name, bookmarkData);
                    forwarder.print(`Bookmark "${name}" created.`);
                } catch (e) {
                    forwarder.warn("Failed to create bookmark.");
                    forwarder.warn((e as Error).message);
                }
                nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
            });
            await handler.onAnyCommand(async command => forwarder.warn("Unexpected command: " + command.join(" ")));
            await handler.onGetWords(async () => forwarder.words([], allOptions));
            await handler.onAny(async message => forwarder.send(message));
            return nextState;
        }
    }], ["bookmark-selected", {
        onEnter : (forwarder : DecoratedForwarder) => {
            forwarder.print("Bookmark selected.");
            // Options Load/Delete/Export/Cancel
            if (selectedBookmark < 0) {
                forwarder.warn("No bookmark selected.");
                return;
            }
            forwarder.words([], SELECTED_BOOKMARK_OPTIONS);
        },
        onAction : async (input : InputMessage, forwarder : DecoratedForwarder) => {
            if (selectedBookmark < 0) {
                forwarder.warn("No bookmark selected.");
                return "__TERMINATE__";
            }
            const handler = handleInput(input);
            let nextState : Optional<BookmarkManagerState> = undefined;
            // Load Bookmark
            await handler.onCommand([BOOKMARK_ACTIONS.LOAD], async () => {
                forwarder.print("Loading bookmark...");
                try {
                    await loadGameFromBookmark(selectedBookmark, forwarder);
                    forwarder.print("Bookmark loaded.");
                } catch (e) {
                    forwarder.warn("Failed to load bookmark.");
                    forwarder.warn((e as Error).message);
                }
                nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
            });

            // Delete Bookmark
            await handler.onCommand([BOOKMARK_ACTIONS.DELETE], async () => {
                try {
                    forwarder.print("Deleting bookmark...");
                    removeBookmark(selectedBookmark);
                    forwarder.print("Bookmark deleted.");
                } catch (e) {
                    forwarder.warn("Failed to delete bookmark.");
                    forwarder.warn((e as Error).message);
                }
                nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
            });

            /// Export Bookmark
            await handler.onCommand([BOOKMARK_ACTIONS.EXPORT], async () => {
                forwarder.print("Exporting bookmark...");
                try {
                    await exportBookmark(selectedBookmark, forwarder);
                    forwarder.print("Bookmark exported.");
                } catch (e) {
                    forwarder.warn("Failed to export bookmark.");
                    forwarder.warn((e as Error).message);
                }
                nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
            });

            // Cancel
            await handler.onCommand([BOOKMARK_ACTIONS.CANCEL], async () => {    
                forwarder.print("Cancelled.");
                nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
            });
            await handler.onAnyCommand(async command => forwarder.warn("Unexpected command: " + command.join(" ")));
            await handler.onGetWords(async () => {
                forwarder.words([], SELECTED_BOOKMARK_OPTIONS);
            });
            await handler.onAny(async message => forwarder.send(message));
            return nextState;
        }
    }]);
}