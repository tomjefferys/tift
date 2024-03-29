import React from "react";
import { useRef, useState, useEffect, SyntheticEvent } from 'react';
import { getEngine, Input, createEngineProxy, createStateMachineFilter, OutputConsumerBuilder } from "tift-engine"
import { Engine } from "tift-types/src/engine";
import { OutputConsumer, OutputMessage, StatusType } from "tift-types/src/messages/output";
import { PartOfSpeech, Word } from "tift-types/src/messages/word";
import { ControlType } from "tift-types/src/messages/controltype";
import { MessageForwarder } from "tift-types/src/engineproxy";
import Output from "./Output"
import Controls from './Controls';
import { commandEntry, logEntry, messageEntry, OutputEntry } from '../outputentry';
import { Box, Divider, useColorMode } from '@chakra-ui/react'
import { createRestarter } from "../util/restarter";
import { createColourSchemePicker } from "../util/colourschemepicker";
import * as Pauser from './pauser';
import { getUndoRedoFilter } from "../util/undoredofilter";
import { Optional } from "tift-types/src/util/optional";
import { handleKeyboardInput } from "../util/keyboardhandler";
import { BACKSPACE, createSimpleOption } from "../util/util";
import * as WordTree from "../util/wordtree";
import { DuplexProxy } from "tift-types/src/util/duplexproxy";
import { InputMessage } from "tift-types/src/messages/input";
import { getInventoryFilter } from "../util/inventoryfilter";
import _ from "lodash";

type WordTreeType = WordTree.WordTree;

const DEFAULTS_FILE = "properties.yaml";
const STDLIB_FILE = "stdlib.yaml";
const GAME_FILE = "adventure.yaml";
//const GAME_FILE = "example.yaml";
const AUTO_SAVE = "TIFT_AUTO_SAVE";
const MESSAGES = "TIFT_MESSAGES";

const SCROLL_BACK_ITEMS = 200;

const WILD_CARD : PartOfSpeech = {type:"word", partOfSpeech: "verb", id:"?", value:"?", position:0 };

type WordList = Word[];

function Tift() {
    const [command, setCommand] = useState<WordList>([]);

    const [partialWord, setPartialWord] = useState<string>("");
    const { setColorMode } = useColorMode();

    const statusRef = useRef<StatusType>({ title : "", undoable : false, redoable : false, properties : {}});
  
    // Store messages as a ref, as the can be updated multiple times between renders
    // and using a state makes it tricky to get the most up to date values
    const messagesRef = useRef<OutputEntry[]>([]);

    // Store the latest words from the engine as a ref not a state
    // as we want to avoid the word state updating unnecessarily
    const latestWordsRef = useRef<WordTreeType>(WordTree.createRoot());
  
    const engineRef = useRef<Engine | null>(null);

    const [filteredWords, setFilteredWords] = useState<Word[]>([]);

    const getWords = async (command : Word[]) : Promise<Word[]> => {
      await engineRef.current?.send(Input.getNextWords(command));
      return (command.find(word => word.id === "?") != null)
          ? WordTree.getWildCardMatches(latestWordsRef.current, command)[0]
          : WordTree.get(latestWordsRef.current, command);
    }

    const execute = async (command : Word[]) => await engineRef.current?.send(Input.execute(command.map(word => word.id)));

    // Load a game file from the `public` folder
    const loadGame = async (name : string, engine : MessageForwarder, saveData : string | null) => {
      if (engine == null) {
        throw new Error("Engine has not been initialized");
      }
      engine.send(Input.config({"autoLook" : true, "undoLevels" : 10}));
      engine.send(Input.reset());

      // Load default behaviour
      const defaults = await loadDefaults();
      engine.send(Input.load(defaults));

      // Load the standard library
      const stdlib = await loadStdLib();
      engine.send(Input.load(stdlib));

      // Load the game data
      const data = await loadGameData(name)
      engine.send(Input.load(data));
      engine.send(Input.start((saveData != null)? saveData : undefined));
      engine.send(Input.getStatus());

      engine.send(Input.getNextWords([]));
      setFilteredWords(WordTree.getWithPrefix(latestWordsRef.current, ""));
      setCommand([]);
    }
  
    const changeColourMode = (newMode : string) => {
        setColorMode(newMode);
    }

    // Engine creator
    // Sets up proxies, and returns a new engine
    const createEngine = (saveMessages : (messages : OutputEntry[]) => void) : DuplexProxy<InputMessage, OutputMessage> => {
      // Restart is now running asynchronously, so the thing calling it does not block
      const restartMachine = createRestarter(async forwarder => {
        latestWordsRef.current = WordTree.createRoot();
        window.localStorage.removeItem(AUTO_SAVE);
        await loadGame(GAME_FILE, forwarder, null);
      });

      // Colour scheme picker
      const colourSchemePicker = createColourSchemePicker(value => changeColourMode(value));

      // Log clearer
      const logClearer = createSimpleOption( "clear", () => {
        messagesRef.current = [];
        saveMessages([]);
      });

      const getInfo = createSimpleOption( "info", () => {
        engine.send(Input.getInfo());
      });

      const undoFn = async () => {
        engine.send(Input.undo());
        engine.send(Input.getStatus());
        engine.send(Input.getNextWords([]));
      }

      const redoFn = async () => { 
        engine.send(Input.redo());
        engine.send(Input.getStatus());
        engine.send(Input.getNextWords([]));
      }

      // Create the engine and attach proxies
      const engine = createEngineProxy((output : OutputConsumer) => getEngine(output))
                        .insertProxy("inventory", getInventoryFilter())
                        .insertProxy("undoredo", getUndoRedoFilter(statusRef, undoFn, redoFn))
                        .insertProxy("optionItems", createStateMachineFilter(
                                                    ["restart", restartMachine],
                                                    ["colours", colourSchemePicker],
                                                    ["clear", logClearer],
                                                    ["info", getInfo]));
                        //.insertProxy("pauser", pauser); // FIXME FIX PAUSER
      return engine;
    }
  
    // Initialization
    useEffect(() => {
      if (engineRef.current !== null) {
        return;
      }
  
      const saveGame = (saveData : string) => {
        window.localStorage.setItem(AUTO_SAVE, saveData);
      }

      const saveMessages = (messages : OutputEntry[]) => {
        window.localStorage.setItem(MESSAGES, JSON.stringify(messages));
      }

      const updateMessages = (messages : OutputEntry[], newMessage : OutputEntry) => {
        messages.push(newMessage);
        const deleteCount = messages.length - SCROLL_BACK_ITEMS;
        if (deleteCount > 0) {
            messages.splice(0, deleteCount);
        }
        saveMessages(messages);
      }
  
      // Load messages
      const savedMessages = window.localStorage.getItem(MESSAGES);
      messagesRef.current = savedMessages? JSON.parse(savedMessages) : [];

      // Pauser
      const pauser = Pauser.createPauseFilter(
              async words => WordTree.set(latestWordsRef.current, command, words),
              async words => {getWords(words); /*setWords(latestWordsRef.current)*/});

      const engine = createEngine(saveMessages);

      // Create the output consumer
      const outputConsumer = new OutputConsumerBuilder()
        .withMessageConsumer(message => updateMessages(messagesRef.current, messageEntry(message)))
        .withWordsConsumer((command, words) => WordTree.set(latestWordsRef.current, command, words))
        .withStatusConsumer(status => statusRef.current = status)
        .withSaveConsumer(saveGame)
        .withLogConsumer((level, message) => updateMessages(messagesRef.current,logEntry(level, message)))
        .withControlConsumer(createControlHandler(pauser))
        .build();

      engine.setResponseListener(outputConsumer);
  
      engineRef.current = engine;
      const saveData = window.localStorage.getItem(AUTO_SAVE);
  
      loadGame(GAME_FILE, engine, saveData);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  
    // Add keyboard listener
    useEffect(() => {
      const handleKeyDown = (e : KeyboardEvent) : void => {
        const nextWords = getPossibleNextWords();
        const result = handleKeyboardInput(partialWord, nextWords, e);
        if (result.selected) {
          wordSelected(undefined, result.selected);
        } else {
          setFilteredWords(result.filtered);
        }
        setPartialWord(result.partial);
        return;
      }

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    });
  
    // When command updated
    useEffect(() => {
      commandUpdated();
    }, [command]);

    const commandUpdated = async () => {
      const words = await getWords(command);
      const engine = engineRef.current;
      const gameWords = words.filter(word => word.type === "word");
      if (engine && command.length && !gameWords.length) {
        const commandWords = command.filter(word => word.id !== "?");
        messagesRef.current?.push(commandEntry(commandWords.map(word => word.value).join(" ")))
        await execute(commandWords);
        engine.send(Input.getStatus());
        latestWordsRef.current = WordTree.createRoot();
        setCommand([WILD_CARD]);
        await getWords([WILD_CARD]);
      } 

      if (!command.length || gameWords.length) {
        const words = getPossibleNextWords();
        if (command.length > 1 && gameWords.length && !words.includes(BACKSPACE)) {
          words.push(BACKSPACE);
        }
        setFilteredWords(words);
      }
    }

    /**
     * Gets all the next possible words for the current command
     * If the are wildcards this will be the words at the position of the first wildcard
     * If there are no wildcards this will be the words that follow the command
     * Will take into account the current partial word to further filter available words
     * @returns
     */
    const getPossibleNextWords = () => {
        let tree = latestWordsRef.current;
        let commandWords = command;
        const wildCardIndex = command.findIndex(word => word.id === "?");
        if (wildCardIndex !== -1) {
          // Limit the tree to only the words that match the command
          tree = WordTree.getSubTree(tree, command);
          // Don't including anything after the wildcard for the prefix
          commandWords = command.slice(0, wildCardIndex);
        }
        let words = WordTree.getWithPrefix(tree, commandWords.map(word => word.value).join(" "));
        if (!command.filter(word => word.id !== '?').length) {
          // Strip out any words that are only for the inventory context 
          const getContexts = (word : Word) => word.tags?.filter(tag => tag.startsWith("context")) ?? [];
          words = words.filter(word => !(_.isEqual(getContexts(word), ["context:inventory"])));
        }
        return words;
    }
  
    const wordSelected = (_event : Optional<SyntheticEvent>, word : Word) => {
      //The selected word should replace the first wildcard
      if (word === BACKSPACE) {
        if (command.length > 1) {
          let newCommand;
          if (command[command.length - 1].id === "?") {
            newCommand = [...command.slice(0, -2), WILD_CARD];
          } else {
            newCommand = command.slice(0, -1);
          }
          setCommand(newCommand);
        }
      } else if (word.type === "option") {
        setCommand([word]);
      } else if (word.type === "word" && word.tags?.includes("inventory")) {
        const position = word.position - 1;
        setCommand([ {...WILD_CARD, position}, word]);
      } else {
        const wildCardIndex = command.findIndex(word => word.id === "?");
        if (wildCardIndex !== -1) {
          setCommand([...command.slice(0, wildCardIndex),
                      word,
                      ...command.slice(wildCardIndex + 1),
                      WILD_CARD]);
        } else if (word.type === "word" && word.tags && word.tags.includes("truncated")) {
            // TODO not sure if we need this any more
            const matchedPhrase = WordTree.matchPhrase(latestWordsRef.current, [...command, word].map(word => word.value).join(" ") );
            if (matchedPhrase) { 
              setCommand(matchedPhrase);
            }
        } else {
          setCommand([...command, word, WILD_CARD]);
        } 
      }
    }

    const getCommand = () : string => {
      const wildCardIndex = command.findIndex(word => word.id === "?");
      const wordStrs = command.map(word => word.value);
      const partialStr = partialWord.length? partialWord : "";
      let words = wordStrs;
      if (wildCardIndex != -1) {
        words = [...wordStrs.slice(0, wildCardIndex), 
                       partialStr,
                       ...wordStrs.slice(wildCardIndex + 1)];
      } else {
        words = [...wordStrs, partialStr];
      }
      return words.map(word => word).join(" ");
    }

    return (
        <React.Fragment>
            <Box position={"relative"} height="69%">
              <Output entries={messagesRef.current ?? []} status={statusRef.current.title} command={getCommand()}/>
            </Box>
            <Divider/>
            <Box position={"relative"} height="30%">
              <Controls words={filteredWords ?? []} wordSelected={wordSelected}/>
            </Box>
        </React.Fragment>
      );
}

function createControlHandler(pauser : Pauser.Pauser) : (control : ControlType) => void {
  return control => {
    if (control.type === "pause") {
      pauser.pause(control.durationMillis);
    }
  }
}

async function loadDefaults() : Promise<string> {
    return fetch(process.env.PUBLIC_URL + "/" + DEFAULTS_FILE)
            .then((response) => response.text());
}

async function loadStdLib() : Promise<string> {
    return fetch(process.env.PUBLIC_URL + "/" + STDLIB_FILE)
            .then((response) => response.text());
}

async function loadGameData(name : string) : Promise<string> {
    return fetch(process.env.PUBLIC_URL + "/" + name)
            .then((response) => response.text());
}

export default Tift;