import { Properties } from "tift-types/src/messages/output";
import { LogLevel } from "../outputentry";

/**
 * Module responsible for storing messages, and game state to localStorage
 */

type Logger = (logLevel : LogLevel, message : string) => void;

// Prefixes used to distinguish different types of save data
const SAVE_PREFIX = "TIFT_AUTO_SAVE";
const MESSAGES_PREFIX = "TIFT_MESSAGES";

// localStorage methods
const getItem = (key : string) => window.localStorage.getItem(key);
const setItem = (key : string, value : string) => window.localStorage.setItem(key, value);
const removeItem = (key : string) => window.localStorage.removeItem(key);

// Storage type, exposing methods to manipulate the storage
export interface GameStorage {
    saveGame : (gameData : string) => void;
    loadGame : () => string | null;
    removeGame : () => void;
    saveMessages : (messages : string) => void;
    loadMessages : () => string | null;
    removeMessages : () => void;
}

// Create a Storage object
export function createStorage(gameInfo : Properties, logger : Logger) : GameStorage {
    const gameId = gameInfo["gameId"];
    return gameId? createStorageWithGameId(gameId) : errorAndCreateDummyStorage(logger);
}

function createStorageWithGameId(gameId : string) : GameStorage {
    const SAVE_KEY = `${SAVE_PREFIX}_${gameId}`;
    const MESSAGES_KEY = `${MESSAGES_PREFIX}_${gameId}`;
    return {
        saveGame : (gameData) => setItem(SAVE_KEY, gameData),
        loadGame : () => getItem(SAVE_KEY),
        removeGame : () => removeItem(SAVE_KEY),
        saveMessages : (messages) => setItem(MESSAGES_KEY, messages),
        loadMessages : () => getItem(MESSAGES_KEY),
        removeMessages : () => removeItem(MESSAGES_KEY)
    }
}

function errorAndCreateDummyStorage(logger : Logger) : GameStorage {
    logger("error", "No gameId provided. Game can not be saved.");
    return {
        saveGame : (_gameData) => { /* do nothing */ },
        loadGame : () => null,
        removeGame : () => { /* do nothing */ },
        saveMessages : (_messages) => { /* do nothing */ },
        loadMessages : () => null,
        removeMessages : () => { /* do nothing */ }
    }
}

