import * as ReactUtils from "./reactutils";
import * as GameLibrary from "./gamelibrary";
import { SavedGame } from "./gamelibrary";
import { word, createStateMachine, handleInput } from "tift-engine"
import { StateMachine } from "tift-types/src/util/statemachine";
import { InputMessage } from 'tift-types/src/messages/input';
import { Word } from "tift-types/src/messages/word";
import { DecoratedForwarder } from "tift-types/src/engineproxy";
import { Optional } from "tift-types/src/util/optional";

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
    EDIT = "edit",
    ENTITIES = "entities",
    DELETE = "delete",
    SELECT = "select",
    EXPORT = "export",
    CANCEL = "cancel",
}

const SELECTED_GAME_OPTIONS = [
    word(GAME_ACTIONS.LOAD, GAME_ACTIONS.LOAD, "select"),
    word(GAME_ACTIONS.EDIT, GAME_ACTIONS.EDIT, "select"),
    word(GAME_ACTIONS.ENTITIES, "entities", "select"),
    word(GAME_ACTIONS.EXPORT, GAME_ACTIONS.EXPORT, "select"),
    word(GAME_ACTIONS.DELETE, GAME_ACTIONS.DELETE, "select"),
    word(GAME_ACTIONS.CANCEL, GAME_ACTIONS.CANCEL, "select"),
];

type GameLoader = (yamlText : string, forwarder : DecoratedForwarder) => Promise<void>;
type DefaultGameLoader = (forwarder : DecoratedForwarder) => Promise<void>;
type EditRequestHandler = (index : number, game : SavedGame) => void;

interface GameManagerOptions {
    games : GameLibrary.SavedGameList;
    selectOptions : Word[];
    extraOptions : Word[];
    allOptions : Word[];
}

/**
 * Creates the game manager options state machine: a local library of imported
 * games (stored in localStorage via gamelibrary.ts), with import/export/edit/
 * load/delete actions, all driven by tapped words like the other option state
 * machines.
 * @param gameLoader Function to load a game from its raw YAML text
 * @param defaultGameLoader Function to switch back to the built-in default game
 * @param onEditRequested Called when the user chooses to edit the selected game's raw YAML
 * @param onEntitiesRequested Called when the user chooses to browse/edit the selected game's entities (rooms, items & verbs)
 * @returns The game manager state machine
 */
export function createGameManagerOptions(gameLoader : GameLoader,
                                          defaultGameLoader : DefaultGameLoader,
                                          onEditRequested : EditRequestHandler,
                                          onEntitiesRequested : EditRequestHandler) : StateMachine<InputMessage, DecoratedForwarder> {

    const exportGame = (selectedGame : number) : void => {
        const games = GameLibrary.getGames();
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
            return GameLibrary.addOrUpdateGame(yamlText);
        } catch (e) {
            throw new Error("Failed to import game: " + (e instanceof Error ? e.message : String(e)));
        }
    }

    const getGameOptions = () : GameManagerOptions => {
        const games = GameLibrary.getGames();
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
        const games = GameLibrary.getGames();
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

            // Edit game
            await handler.onCommand([GAME_ACTIONS.EDIT], async () => {
                const games = GameLibrary.getGames();
                if (selectedGame < 0 || selectedGame >= games.length) {
                    forwarder.warn("Invalid game selected.");
                } else {
                    onEditRequested(selectedGame, games[selectedGame]);
                }
                nextState = GAME_MANAGER_STATES.TERMINATE;
            });

            // Browse/edit entities (rooms, items & verbs)
            await handler.onCommand([GAME_ACTIONS.ENTITIES], async () => {
                const games = GameLibrary.getGames();
                if (selectedGame < 0 || selectedGame >= games.length) {
                    forwarder.warn("Invalid game selected.");
                } else {
                    onEntitiesRequested(selectedGame, games[selectedGame]);
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
                    GameLibrary.removeGame(selectedGame);
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
