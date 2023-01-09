import React from "react";
import { useRef, useState, useEffect, SyntheticEvent } from 'react';
import { getEngine, Input, createEngineProxy, word, createStateMachineFilter, buildStateMachine, handleInput } from "tift-engine"
import { Engine } from "tift-engine/src/engine";
import { OutputConsumer, OutputMessage, Word } from "tift-engine/src/messages/output";
import { MessageForwarder, DecoratedForwarder } from "tift-engine/src/engineproxy";
import Output from "./Output"
import Controls from './Controls';
import { commandEntry, logEntry, LogLevel, messageEntry, OutputEntry } from '../outputentry';
import { Box, Divider, useColorMode } from '@chakra-ui/react'
import { InputMessage } from 'tift-engine/src/messages/input';

const GAME_FILE = "adventure.yaml";
//const GAME_FILE = "example.yaml";
const AUTO_SAVE = "TIFT_AUTO_SAVE";

const BACKSPACE : Word = { type : "control", id : "__BACKSPACE__", value : "BACKSPACE" };

function Tift() {
    const [command, setCommand] = useState<Word[]>([]);
    const [words, setWords] = useState<Word[]>([]);
    const [status, setStatus] = useState<string>("");
    const { setColorMode } = useColorMode();
  
    // Store messages as a ref, as the can be updated multiple times between renders
    // and using a state makes it tricky to get the most up to date values
    const messagesRef = useRef<OutputEntry[]>([]);
  
    const engineRef = useRef<Engine | null>(null)
  
    const getWords = (command : Word[]) => engineRef.current?.send(Input.getNextWords(command.map(word => word.id)));
    const execute = (command : Word[]) => engineRef.current?.send(Input.execute(command.map(word => word.id)));
  
    // Load a game file from the `public` folder
    const loadGame = (name : string, engine : MessageForwarder, saveData : string | null) => 
            fetch(process.env.PUBLIC_URL + "/" + name)
              .then((response) => response.text())
              .then(data => {
                if (engine == null) {
                  throw new Error("Engine has not been initialized");
                }
                engine.send(Input.reset());
                engine.send(Input.load(data));
                engine.send(Input.config({"autoLook" : true}));
                engine.send(Input.start((saveData != null)? saveData : undefined));
                getWords([]);
                engine.send(Input.getStatus());
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
  
      messagesRef.current = [];
      const outputConsumer = getOutputConsumer(
        message => messagesRef.current?.push(messageEntry(message)),
        words => setWords(words),
        status => setStatus(status),
        (level, message) => messagesRef.current?.push(logEntry(level, message)),
        saveGame
      );
  
      const restartMachine = createRestarter(forwarder => loadGame(GAME_FILE, forwarder, null));
      const colourSchemePicker = createColourSchemePicker(value => changeColourMode(value));
  
      const engine = createEngineProxy((output : OutputConsumer) => getEngine(output))
                        .insertProxy("optionItems", createStateMachineFilter(
                                                    ["restart", restartMachine],
                                                    ["colours", colourSchemePicker]));
      engine.setResponseListener(outputConsumer);
  
      engineRef.current = engine;
      const saveData = window.localStorage.getItem(AUTO_SAVE);
  
      loadGame(GAME_FILE, engine, saveData);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  
    // words updated
    useEffect(() => {
      const engine = engineRef.current;
      const gameWords = words.filter(word => word.type === "word");
      if (engine && command.length && !gameWords.length) {
        messagesRef.current?.push(commandEntry(command.map(word => word.value).join(" ")))
        execute(command);
        engine.send(Input.getStatus());
        setCommand([]);
        getWords([]);
      } else if (engine && command.length && gameWords.length) {
        // Add in backspace if it's not already there
        if (!words.includes(BACKSPACE)) {
          setWords([...words, BACKSPACE]);
        }
      }
    }, [words, command]);
  
    // command updated
    useEffect(() => {
      const engine = engineRef.current;
      if (engine) {
        getWords(command);
      }
    }, [command])
  
    const wordSelected = (_event : SyntheticEvent, word : Word) => {
      if (word === BACKSPACE) {
        setCommand(command.slice(0, -2));
      } else if (word.type === "option") {
        setCommand([word]);
      } else {
        setCommand([...command, word]);
      }
    }
    return (
        <React.Fragment>
            <Box position={"relative"} height="69%">
              <Output entries={messagesRef.current ?? []} status={status} command={command.map(word => word.value).join(" ")}/>
            </Box>
            <Divider/>
            <Box position={"relative"} height="30%">
              <Controls words={words ?? []} wordSelected={wordSelected}/>
            </Box>
        </React.Fragment>
      );
}

function getOutputConsumer(messageConsumer : (message : string) => void,
                           wordsConsumer : (words : Word[]) => void,
                           statusConsumer : (status : string) => void,
                           logConsumer : (level : LogLevel, message : string) => void,
                           saveConsumer : (saveData : string) => void) : (outputMessage : OutputMessage) => void {
  return (outputMessage) => {
    switch(outputMessage.type) {
      case "Print":
        messageConsumer(outputMessage.value);
        break;
      case "Words":
        wordsConsumer(outputMessage.words);
        break;
      case "Status":
        statusConsumer(outputMessage.status);
        break;
      case "SaveState": 
        saveConsumer(JSON.stringify(outputMessage.state));
        break;
      case "Log":
        logConsumer(outputMessage.level, outputMessage.message);
        break;
      default:
        throw new Error("Unsupported OutputMessage Type: " + outputMessage.type);
    }
  }
}

function createRestarter(restartFn : (forwarder : DecoratedForwarder) => void) {
    const restartOptions = ["restart", "cancel"].map(value => word(value, value, "option"));

    return buildStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            forwarder.print("All progress will be lost. Are you sure?");
            forwarder.words([], restartOptions);
        },
        onAction : (input : InputMessage, forwarder : DecoratedForwarder) => {
            let finished = false;
            handleInput(input)
                .onCommand(["restart"], () => {
                    forwarder.print("restarting");
                    restartFn(forwarder);
                    finished = true;
                })
                .onCommand(["cancel"], () => {
                    forwarder.print("cancelled");
                    finished = true;
                })
                .onAnyCommand(command => forwarder.warn("Unexpected command: " + command.join(" ")))
                .onGetWords(() => forwarder.words([], restartOptions))
                .onAny(message => forwarder.send(message));
            return finished ? "__TERMINATE__" : undefined;
        }
    }]);
}

function createColourSchemePicker(schemeChanger : (scheme : string) => void) {
    const colourSchemes = ["light", "dark"].map(value => word(value, value, "option"));
    return buildStateMachine("prompt", ["prompt", {
        onEnter : (forwarder : DecoratedForwarder) => {
            forwarder.print("Select a colour scheme: light, dark");
            forwarder.words([], colourSchemes);
        },
        onAction : (input : InputMessage, forwarder : DecoratedForwarder) => {
            let finished = false;
            handleInput(input)
                .onCommand(["light"], () => {
                    forwarder.print("changing to light scheme");
                    schemeChanger("light");
                    finished = true;
                })
                .onCommand(["dark"], () => {
                    forwarder.print("changing to dark scheme");
                    schemeChanger("dark");
                    finished = true;
                })
                .onCommand(["cancel"], () => {
                    forwarder.print("cancelled");
                    finished = true;
                })
                .onAnyCommand(command => forwarder.warn("Unexpected command: " + command.join(" ")))
                .onGetWords(() => forwarder.words([], colourSchemes))
                .onAny(message => forwarder.send(message));
            return finished ? "__TERMINATE__" : undefined;
        }
    }]);
}

export default Tift;