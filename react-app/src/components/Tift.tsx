import React from "react";
import { useRef, useState, useEffect, SyntheticEvent } from 'react';
import { getEngine, Input, createEngineProxy, createStateMachineFilter, OutputConsumerBuilder } from "tift-engine"
import { Engine } from "tift-types/src/engine";
import { OutputConsumer, OutputMessage, StatusType, Word } from "tift-types/src/messages/output";
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

type WordTreeType = WordTree.WordTree;

const DEFAULTS_FILE = "properties.yaml";
const STDLIB_FILE = "stdlib.yaml";
const GAME_FILE = "adventure.yaml";
//const GAME_FILE = "example.yaml";
const AUTO_SAVE = "TIFT_AUTO_SAVE";
const MESSAGES = "TIFT_MESSAGES";

const SCROLL_BACK_ITEMS = 200;

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
      await engineRef.current?.send(Input.getNextWords(command.map(word => word.id)));
      return WordTree.get(latestWordsRef.current, command);
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
        const result = handleKeyboardInput(partialWord, 
                WordTree.getWithPrefix(latestWordsRef.current, command.map(word => word.value).join(" ")), e);
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
        messagesRef.current?.push(commandEntry(command.map(word => word.value).join(" ")))
        await execute(command);
        engine.send(Input.getStatus());
        latestWordsRef.current = WordTree.createRoot();
        setCommand([]);
        await getWords([]);
      } else if (engine && command.length && gameWords.length) {
        // Add in backspace if it's not already there
        if (!words.includes(BACKSPACE)) {
          WordTree.addLeaf(latestWordsRef.current, BACKSPACE);
        }
      }
      if (!command.length || gameWords.length) {
        setFilteredWords(WordTree.getWithPrefix(latestWordsRef.current, command.map(word => word.value).join(" ")));
      }
    }
  
    const wordSelected = (_event : Optional<SyntheticEvent>, word : Word) => {
      if (word === BACKSPACE) {
        setCommand(command.slice(0, -2));
      } else if (word.type === "option") {
        setCommand([word]);
      } else {
        if (word.type === "word" && word.tags && word.tags.includes("truncated")) {
            const matchedPhrase = WordTree.matchPhrase(latestWordsRef.current, [...command, word].map(word => word.value).join(" ") );
            if (matchedPhrase) { 
              setCommand(matchedPhrase);
            }
        } else {
          setCommand([...command, word]);
        }
      }
    }

    const getCommand = () : string => {
      return command.map(word => word.value).join(" ")
                + ((partialWord.length)? " " + partialWord : "");
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