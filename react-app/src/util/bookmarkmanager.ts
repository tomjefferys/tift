import { Properties, StatusType } from "tift-types/src/messages/output";
import { createSimpleOption } from "./util";
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

interface Bookmark {
    name : string;
    data : string;
}

type BookmarkList = Bookmark[];

type GameLoader = (gameData : string, forwarder : DecoratedForwarder) => Promise<void>;

export interface BookmarkManager {
    setBookmark(data : string) : Promise<boolean>;
    getBookmark() : Promise<string | null>;
}

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
        gameLoader : GameLoader) : StateMachine<InputMessage, DecoratedForwarder> {
    let selectedBookmark = -1;
    return createStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            selectedBookmark = -1;
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
                    forwarder.print("Creating new bookmark...");
                    const bookmarkData = await getBookmarkData(bookmarkRef, forwarder);
                    //const name = `Bookmark ${new Date().toLocaleString()}`;
                    if (!statusRef.current) {
                        forwarder.warn("Cannot create bookmark: game status unknown.");
                        nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
                        return;
                    }
                    const name = generateBookmarkName(statusRef.current);
                    if (addBookmark(name, bookmarkData)) {
                        forwarder.print(`Bookmark "${name}" created.`);
                    } else {
                        forwarder.warn("Maximum number of bookmarks reached. Cannot create new bookmark.");
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
            forwarder.words([], getSelectedBookmarkOptions());
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
                await loadGameFromBookmark(selectedBookmark, gameLoader, forwarder);
                forwarder.print("Bookmark loaded.");
                nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
            });

            // Delete Bookmark
            await handler.onCommand([BOOKMARK_ACTIONS.DELETE], async () => {
                forwarder.print("Deleting bookmark...");
                removeBookmark(selectedBookmark);
                forwarder.print("Bookmark deleted.");
                nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
            });

            // Cancel
            await handler.onCommand([BOOKMARK_ACTIONS.CANCEL], async () => {    
                forwarder.print("Cancelled.");
                nextState = BOOKMARK_MANAGER_STATES.TERMINATE;
            });
            await handler.onAnyCommand(async command => forwarder.warn("Unexpected command: " + command.join(" ")));
            await handler.onGetWords(async () => {
                forwarder.words([], getSelectedBookmarkOptions());
            });
            await handler.onAny(async message => forwarder.send(message));
            return nextState;
        }
    }]);
}


async function loadGameFromBookmark(bookmarkIndex : number, gameLoader : GameLoader, forwarder : DecoratedForwarder) : Promise<void> {
    const bookmarkList = getBookmarkList();
    if (bookmarkIndex >= 0 && bookmarkIndex < bookmarkList.length) {
        const bookmark = bookmarkList[bookmarkIndex];
        try {
            const decompressedData = await ReactUtils.decodeAndDecompress(bookmark.data); 
            return gameLoader(decompressedData, forwarder);
        } catch (e) {
            forwarder.warn("Failed to decompress bookmark data.");
            return;
        }
    } else {
        forwarder.warn("Invalid bookmark selected.");
    }
}

function generateBookmarkName(status : StatusType) : string {
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit' });
    return `${status.title} - ${dateStr} ${timeStr}`;
}   

function getBookmarkOptions() : BookmarkOptions {
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

function getSelectedBookmarkOptions() : Word[] {
    return [
        word(BOOKMARK_ACTIONS.LOAD, BOOKMARK_ACTIONS.LOAD, "select"),
        word(BOOKMARK_ACTIONS.DELETE, BOOKMARK_ACTIONS.DELETE, "select"),
        word(BOOKMARK_ACTIONS.CANCEL, BOOKMARK_ACTIONS.CANCEL, "select")
    ];
}

async function getBookmarkData(bookmarkRef : React.MutableRefObject<string | null>, forwarder : DecoratedForwarder) : Promise<string> {
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
            forwarder.warn("Failed to bookmark game.");
            throw new Error("Failed to bookmark game.");
        }
}

function getBookmarkList() : BookmarkList {
    const data = window.localStorage.getItem(TIFT_BOOKMARKS);
    if (data) {
        return JSON.parse(data) as BookmarkList;
    }
    return [];
}

function saveBookmarkList(bookmarks : BookmarkList) {
    const data = JSON.stringify(bookmarks);
    window.localStorage.setItem(TIFT_BOOKMARKS, data);
}

function addBookmark(name : string, data : string) : boolean{
    const bookmarks = getBookmarkList();
    if (bookmarks.length >= MAX_BOOKMARKS) {
        return false;
    }
    bookmarks.push({ name, data });
    saveBookmarkList(bookmarks);
    return true;
}

function removeBookmark(index : number) {
    const bookmarks = getBookmarkList();
    if (index >= 0 && index < bookmarks.length) {
        bookmarks.splice(index, 1);
        saveBookmarkList(bookmarks);
    }
}
