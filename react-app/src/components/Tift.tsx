import React from "react";
import { useRef, useState, useEffect, SyntheticEvent } from 'react';
import { getEngine, Input, createEngineProxy, createStateMachineFilter } from "tift-engine"
import { Engine } from "tift-types/src/engine";
import { OutputConsumer, OutputMessage, StatusType, Word } from "tift-types/src/messages/output";
import { ControlType } from "tift-types/src/messages/controltype";
import { MessageForwarder } from "tift-types/src/engineproxy";
import Output from "./Output"
import Controls from './Controls';
import { commandEntry, logEntry, LogLevel, messageEntry, OutputEntry } from '../outputentry';
import { Box, Divider, useColorMode } from '@chakra-ui/react'
import { createRestarter } from "../util/restarter";
import { createColourSchemePicker } from "../util/colourschemepicker";
import * as Pauser from './pauser';
import { getUndoRedoFilter } from "../util/undoredofilter";
import { Optional } from "tift-types/src/util/optional";
import { handleKeyboardInput } from "../util/keyboardhandler";
import { BACKSPACE, createSimpleOption } from "../util/util";
import * as WordTree from "../util/wordtree";

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
    const [words, setWords] = useState<WordTreeType>(WordTree.createRoot());

    const [partialWord, setPartialWord] = useState<string>("");
    const { setColorMode } = useColorMode();

    const statusRef = useRef<StatusType>({ title : "", undoable : false, redoable : false});
  
    // Store messages as a ref, as the can be updated multiple times between renders
    // and using a state makes it tricky to get the most up to date values
    const messagesRef = useRef<OutputEntry[]>([]);

    // Store the latest words from the engine as a ref, separate from
    // the word state, as we want to avoid the word state updating unnecessarilly
    const latestWordsRef = useRef<WordTreeType>(words);
  
    const engineRef = useRef<Engine | null>(null);

    const [filteredWords, setFilteredWords] = useState<Word[]>([]);

    const getWords = (command : Word[]) => {
      engineRef.current?.send(Input.getNextWords(command.map(word => word.id)));
    }
    const execute = (command : Word[]) => engineRef.current?.send(Input.execute(command.map(word => word.id)));

    // Load a game file from the `public` folder
    const loadGame = (name : string, engine : MessageForwarder, saveData : string | null) => 
            fetch(process.env.PUBLIC_URL + "/" + name)
              .then((response) => response.text())
              .then(async data => {
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
                engine.send(Input.load(data));
                engine.send(Input.start((saveData != null)? saveData : undefined));
                engine.send(Input.getStatus());
                getWords([]);
                setWords(latestWordsRef.current);
                setFilteredWords(WordTree.getWithPrefix(latestWordsRef.current, ""));
              })
  
    const changeColourMode = (newMode : string) => {
        setColorMode(newMode);
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

      // Set up Proxies
      const restartMachine = createRestarter(forwarder => {
        window.localStorage.removeItem(AUTO_SAVE);
        loadGame(GAME_FILE, forwarder, null)
      });
      const colourSchemePicker = createColourSchemePicker(value => changeColourMode(value));
      const logClearer = createSimpleOption( "clear", () => {
        messagesRef.current = [];
        saveMessages([]);
      });
      const pauser = Pauser.createPauseFilter(
              words => WordTree.set(latestWordsRef.current, command, words),
              words => {getWords(words); setWords(latestWordsRef.current)});

      const undoFn = () => {
        engine.send(Input.undo());
        engine.send(Input.getStatus());
        engine.send(Input.getNextWords([]));
      }

      const redoFn = () => { 
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
                                                    ["clear", logClearer]))
                        .insertProxy("pauser", pauser);

      // Create the output consumer
      const outputConsumer = getOutputConsumer(
        message => updateMessages(messagesRef.current, messageEntry(message)), 
        (command, words) => WordTree.set(latestWordsRef.current, command, words),
        status => statusRef.current = status,
        (level, message) => updateMessages(messagesRef.current,logEntry(level, message)),
        saveGame,
        createControlHandler(pauser)
      );

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
                WordTree.getWithPrefix(words, command.map(word => word.value).join(" ")), e);
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
      getWords(command);
      const words = WordTree.get(latestWordsRef.current, command);
      const engine = engineRef.current;
      const gameWords = words.filter(word => word.type === "word");
      if (engine && command.length && !gameWords.length) {
        messagesRef.current?.push(commandEntry(command.map(word => word.value).join(" ")))
        execute(command);
        engine.send(Input.getStatus());
        latestWordsRef.current = WordTree.createRoot();
        setCommand([]);
        getWords([]);
      } else if (engine && command.length && gameWords.length) {
        // Add in backspace if it's not already there
        if (!words.includes(BACKSPACE)) {
          WordTree.addLeaf(latestWordsRef.current, BACKSPACE);
        }
      }
      setWords(latestWordsRef.current);
      setFilteredWords(WordTree.getWithPrefix(latestWordsRef.current, command.map(word => word.value).join(" ")));
    }, [command]);
  
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

function getOutputConsumer(messageConsumer : (message : string) => void,
                           wordsConsumer : (command : string[], words : Word[]) => void,
                           statusConsumer : (status : StatusType) => void,
                           logConsumer : (level : LogLevel, message : string) => void,
                           saveConsumer : (saveData : string) => void,
                           controlConsumer : (control : ControlType) => void ) : (outputMessage : OutputMessage) => void {
  return (outputMessage) => {
    switch(outputMessage.type) {
      case "Print":
        messageConsumer(outputMessage.value);
        break;
      case "Words":
        wordsConsumer(outputMessage.command, outputMessage.words);
        break;
      case "Status":
        statusConsumer(outputMessage.status);
        break;
      case "SaveState": {
          const saveData = JSON.stringify(outputMessage.state);
          saveConsumer(saveData);
        }
        break;
      case "Log":
        logConsumer(outputMessage.level, outputMessage.message);
        break;
      case "Control":
        controlConsumer(outputMessage.value);
        break;
      default:
        throw new Error("Unsupported OutputMessage Type: " + outputMessage.type);
    }
  }
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

export default Tift;