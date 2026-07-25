import { Optional } from "tift-types/src/util/optional";

const MAX_GAMES = 20;

const TIFT_GAMES = "TIFT_GAMES";

export interface SavedGame {
    id : string;
    name : string;
    yamlText : string;
    lastModified : number;
}

export type SavedGameList = SavedGame[];

/**
 * Pulls a display name and gameId straight out of a game's raw YAML metadata
 * document (the `game:`/`gameId:` fields), without needing a YAML parser
 * dependency or a full engine load just to list saved games.
 */
function extractGameMetadata(yamlText : string) : { name : string, gameId : Optional<string> } {
    const nameMatch = yamlText.match(/^\s*game\s*:\s*(.+?)\s*$/m);
    const gameIdMatch = yamlText.match(/^\s*gameId\s*:\s*(.+?)\s*$/m);
    return {
        name: nameMatch ? nameMatch[1] : "Untitled game",
        gameId: gameIdMatch ? gameIdMatch[1] : undefined,
    };
}

export function getGames() : SavedGameList {
    const data = window.localStorage.getItem(TIFT_GAMES);
    if (data) {
        return JSON.parse(data) as SavedGameList;
    }
    return [];
}

function saveGames(games : SavedGameList) : void {
    window.localStorage.setItem(TIFT_GAMES, JSON.stringify(games));
}

// Adds a newly imported game to the library, or overwrites an existing
// entry with the same gameId if this game has been imported before.
export function addOrUpdateGame(yamlText : string) : SavedGame {
    const { name, gameId } = extractGameMetadata(yamlText);
    const games = getGames();
    const id = gameId ?? `local-${games.length}-${name}`;
    const existingIndex = games.findIndex(game => game.id === id);
    const savedGame : SavedGame = { id, name, yamlText, lastModified : Date.now() };
    if (existingIndex !== -1) {
        games[existingIndex] = savedGame;
    } else {
        if (games.length >= MAX_GAMES) {
            throw new Error("Maximum number of saved games reached. Delete a game before importing another.");
        }
        games.push(savedGame);
    }
    saveGames(games);
    return savedGame;
}

export function removeGame(index : number) : void {
    const games = getGames();
    if (index < 0 || index >= games.length) {
        throw new Error("Invalid game index. Cannot remove game.");
    }
    games.splice(index, 1);
    saveGames(games);
}

// Updates the YAML text of an already saved game in place, keeping its
// library id stable (so editing a game never forks it into a new entry),
// but refreshing its display name in case the `game:` title changed.
export function updateGameYaml(index : number, yamlText : string) : SavedGame {
    const games = getGames();
    if (index < 0 || index >= games.length) {
        throw new Error("Invalid game index. Cannot update game.");
    }
    const { name } = extractGameMetadata(yamlText);
    const updated : SavedGame = { ...games[index], name, yamlText, lastModified : Date.now() };
    games[index] = updated;
    saveGames(games);
    return updated;
}
