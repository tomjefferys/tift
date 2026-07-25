import * as ReactUtils from "./reactutils";
import { word, createStateMachine, handleInput } from "tift-engine"
import { StateMachine } from "tift-types/src/util/statemachine";
import { InputMessage } from 'tift-types/src/messages/input';
import { Word } from "tift-types/src/messages/word";
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import { Optional } from "tift-types/src/util/optional";

const MAX_GAMES = 20;

const TIFT_GAMES = "TIFT_GAMES";

const IMPORT_EXPORT_EXTENSION = ".yaml";

const enum GAME_MANAGER_STATES {
    PROMPT = "prompt",
    GAME_SELECTED = "game-selected",
    TERMINATE = "__TERMINATE__",
}

type GameManagerState = `${GAME_MANAGER_STATES}`;

const enum OPTIONS {
    IMPORT = "import",
    DEFAULT = "default",
    CANCEL = "cancel",
}

const enum GAME_ACTIONS {
    LOAD = "load",
    DELETE = "delete",
    SELECT = "select",
    EXPORT = "export",
    CANCEL = "cancel",
}

const SELECTED_GAME_OPTIONS = [
    word(GAME_ACTIONS.LOAD, GAME_ACTIONS.LOAD, "select"),
    word(GAME_ACTIONS.EXPORT, GAME_ACTIONS.EXPORT, "select"),
    word(GAME_ACTIONS.DELETE, GAME_ACTIONS.DELETE, "select"),
    word(GAME_ACTIONS.CANCEL, GAME_ACTIONS.CANCEL, "select"),
];

interface SavedGame {
    id : string;
    name : string;
    yamlText : string;
    lastModified : number;
}

type SavedGameList = SavedGame[];

type GameLoader = (yamlText : string, forwarder : DecoratedForwarder) => Promise<void>;
type DefaultGameLoader = (forwarder : DecoratedForwarder) => Promise<void>;

interface GameManagerOptions {
    games : SavedGameList;
    selectOptions : Word[];
    extraOptions : Word[];
    allOptions : Word[];
}

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

/**
 * Creates the game manager options state machine: a local library of imported
 * games (stored in localStorage), with import/export/load/delete actions,
 * all driven by tapped words like the other option state machines.
 * @param gameLoader Function to load a game from its raw YAML text
 * @param defaultGameLoader Function to switch back to the built-in default game
 * @returns The game manager state machine
 */
export function createGameManagerOptions(gameLoader : GameLoader, defaultGameLoader : DefaultGameLoader) : StateMachine<InputMessage, DecoratedForwarder> {

    const getGameList = () : SavedGameList => {
        const data = window.localStorage.getItem(TIFT_GAMES);
        if (data) {
            return JSON.parse(data) as SavedGameList;
        }
        return [];
    }

    const saveGameList = (games : SavedGameList) : void => {
        window.localStorage.setItem(TIFT_GAMES, JSON.stringify(games));
    }

    // Adds a newly imported game to the library, or overwrites an existing
    // entry with the same gameId if this game has been imported before.
    const addOrUpdateGame = (yamlText : string) : SavedGame => {
        const { name, gameId } = extractGameMetadata(yamlText);
        const games = getGameList();
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
        saveGameList(games);
        return savedGame;
    }

    const removeGame = (index : number) : void => {
        const games = getGameList();
        if (index < 0 || index >= games.length) {
            throw new Error("Invalid game index. Cannot remove game.");
        }
        games.splice(index, 1);
        saveGameList(games);
    }

    const exportGame = (selectedGame : number) : void => {
        const games = getGameList();
        if (selectedGame < 0 || selectedGame >= games.length) {
            throw new Error("Invalid game selected for export.");
        }
        const game = games[selectedGame];
        const filename = `${game.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${IMPORT_EXPORT_EXTENSION}`;
        ReactUtils.downloadTextFile(filename, game.yamlText);
    }

    const importGame = async () : Promise<SavedGame> => {
        try {
            const yamlText = await ReactUtils.promptForTextFile("Select Game File", [IMPORT_EXPORT_EXTENSION]);
            return addOrUpdateGame(yamlText);
        } catch (e) {
            throw new Error("Failed to import game: " + (e instanceof Error ? e.message : String(e)));
        }
    }

    const getGameOptions = () : GameManagerOptions => {
        const games = getGameList();
        const selectOptions = games.map((game, index) => word(GAME_ACTIONS.SELECT + "_" + index.toString(), game.name, "select"));
        const extraOptions = [
            word(OPTIONS.IMPORT, "import game", "select"),
            word(OPTIONS.DEFAULT, "default game", "select"),
            word(OPTIONS.CANCEL, OPTIONS.CANCEL, "select"),
        ];
        const allOptions = [...selectOptions, ...extraOptions];
        return { games, selectOptions, extraOptions, allOptions };
    }

    const loadGameByIndex = async (index : number, forwarder : DecoratedForwarder) : Promise<void> => {
        const games = getGameList();
        if (index < 0 || index >= games.length) {
            throw new Error("Invalid game selected.");
        }
        await gameLoader(games[index].yamlText, forwarder);
    }

    let selectedGame = -1;

    return createStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            selectedGame = -1;
            const { allOptions } = getGameOptions();
            forwarder.words([], allOptions);
        },
        onAction : async (input : InputMessage, forwarder : DecoratedForwarder) => {
            const { selectOptions, allOptions } = getGameOptions();
            let nextState : Optional<GameManagerState> = undefined;
            const handler = handleInput(input);

            // Handle selecting a saved game
            selectOptions.forEach(async (option, index) => {
                await handler.onCommand([option.id], async () => {
                    selectedGame = index;
                    nextState = GAME_MANAGER_STATES.GAME_SELECTED;
                });
            });

            // Handle cancelling
            await handler.onCommand([OPTIONS.CANCEL], async () => {
                forwarder.print("cancelled");
                nextState = GAME_MANAGER_STATES.TERMINATE;
            });

            // Handle importing a new game
            await handler.onCommand([OPTIONS.IMPORT], async () => {
                forwarder.print("Importing game...");
                try {
                    const imported = await importGame();
                    forwarder.print(`Game "${imported.name}" imported.`);
                    await gameLoader(imported.yamlText, forwarder);
                    forwarder.print("Game loaded.");
                } catch (e) {
                    forwarder.warn("Failed to import game.");
                    forwarder.warn((e as Error).message);
                }
                nextState = GAME_MANAGER_STATES.TERMINATE;
            });

            // Handle switching back to the built-in default game
            await handler.onCommand([OPTIONS.DEFAULT], async () => {
                forwarder.print("Loading default game...");
                try {
                    await defaultGameLoader(forwarder);
                    forwarder.print("Game loaded.");
                } catch (e) {
                    forwarder.warn("Failed to load default game.");
                    forwarder.warn((e as Error).message);
                }
                nextState = GAME_MANAGER_STATES.TERMINATE;
            });

            await handler.onAnyCommand(async command => forwarder.warn("Unexpected command: " + command.join(" ")));
            await handler.onGetWords(async () => forwarder.words([], allOptions));
            await handler.onAny(async message => forwarder.send(message));
            return nextState;
        }
    }], ["game-selected", {
        onEnter : (forwarder : DecoratedForwarder) => {
            if (selectedGame < 0) {
                forwarder.warn("No game selected.");
                return;
            }
            forwarder.words([], SELECTED_GAME_OPTIONS);
        },
        onAction : async (input : InputMessage, forwarder : DecoratedForwarder) => {
            if (selectedGame < 0) {
                forwarder.warn("No game selected.");
                return "__TERMINATE__";
            }
            const handler = handleInput(input);
            let nextState : Optional<GameManagerState> = undefined;

            // Load game
            await handler.onCommand([GAME_ACTIONS.LOAD], async () => {
                forwarder.print("Loading game...");
                try {
                    await loadGameByIndex(selectedGame, forwarder);
                    forwarder.print("Game loaded.");
                } catch (e) {
                    forwarder.warn("Failed to load game.");
                    forwarder.warn((e as Error).message);
                }
                nextState = GAME_MANAGER_STATES.TERMINATE;
            });

            // Export game
            await handler.onCommand([GAME_ACTIONS.EXPORT], async () => {
                forwarder.print("Exporting game...");
                try {
                    exportGame(selectedGame);
                    forwarder.print("Game exported.");
                } catch (e) {
                    forwarder.warn("Failed to export game.");
                    forwarder.warn((e as Error).message);
                }
                nextState = GAME_MANAGER_STATES.TERMINATE;
            });

            // Delete game
            await handler.onCommand([GAME_ACTIONS.DELETE], async () => {
                try {
                    forwarder.print("Deleting game...");
                    removeGame(selectedGame);
                    forwarder.print("Game deleted.");
                } catch (e) {
                    forwarder.warn("Failed to delete game.");
                    forwarder.warn((e as Error).message);
                }
                nextState = GAME_MANAGER_STATES.TERMINATE;
            });

            // Cancel
            await handler.onCommand([GAME_ACTIONS.CANCEL], async () => {
                forwarder.print("Cancelled.");
                nextState = GAME_MANAGER_STATES.TERMINATE;
            });

            await handler.onAnyCommand(async command => forwarder.warn("Unexpected command: " + command.join(" ")));
            await handler.onGetWords(async () => forwarder.words([], SELECTED_GAME_OPTIONS));
            await handler.onAny(async message => forwarder.send(message));
            return nextState;
        }
    }]);
}
