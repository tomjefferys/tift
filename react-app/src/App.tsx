import { useRef, useState, useEffect } from 'react';
import './App.css';
import { getEngine, Input } from "tift-engine"
import { Engine } from "tift-engine/src/engine";
import { IdValue } from "tift-engine/src/shared";
import { OutputMessage } from "tift-engine/src/messages/output";
import Output from "./components/Output"
import Controls from './components/Controls';
import { commandEntry, logEntry, LogLevel, messageEntry, OutputEntry } from './outputentry';

const GAME_FILE = "adventure.yaml";
//const GAME_FILE = "example.yaml";

function App() {
  const [command, setCommand] = useState<IdValue<string>[]>([]);
  const [words, setWords] = useState<IdValue<string>[]>([]);
  const [status, setStatus] = useState<string>("");

  // Store messages as a ref, as the can be updated multiple times between renders
  // and using a state makes it tricky to get the most up to date values
  const messagesRef = useRef<OutputEntry[]>([]);

  const engineRef = useRef<Engine | null>(null)

  const getWords = (command : IdValue<string>[]) => engineRef.current?.send(Input.getNextWords(command.map(word => word.id)));
  const execute = (command : IdValue<string>[]) => engineRef.current?.send(Input.execute(command.map(word => word.id)));

  // Load a game file from the `public` folder
  const loadGame = (name : string, engine : Engine) => 
          fetch(process.env.PUBLIC_URL + "/" + name)
            .then((response) => response.text())
            .then(data => {
              if (engine == null) {
                throw new Error("Engine has not been initialized");
              }
              engine.send(Input.load(data));
              engine.send(Input.config({"autoLook" : true}));
              engine.send(Input.start());
              getWords([]);
              engine.send(Input.getStatus());
            })

  // Initialization
  useEffect(() => {
    messagesRef.current = [];
    const outputConsumer = getOutputConsumer(
      message => messagesRef.current?.push(messageEntry(message)),
      words => setWords(words),
      status => setStatus(status),
      (level, message) => messagesRef.current?.push(logEntry(level, message))
    );
    const engine = getEngine(outputConsumer);

    engineRef.current = engine;

    loadGame(GAME_FILE, engine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // words updated
  useEffect(() => {
    const engine = engineRef.current;
    if (engine && command.length && !words.length) {
      messagesRef.current?.push(commandEntry(command.map(word => word.value).join(" ")))
      execute(command);
      engine.send(Input.getStatus());
      setCommand([]);
      getWords([]);
    }
  }, [words, command]);

  // command updated
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      getWords(command);
    }
  }, [command])

  return (
    <div className="App">
      <div className="mainFrame">
        <div className="outputArea">
          <Output entries={messagesRef.current ?? []} status={status} command={command.map(word => word.value).join(" ")}/>
        </div>
        <div id="inputArea" className="inputArea">
          <Controls words={words ?? []} wordSelected={(event,word) => setCommand([...command, word])}/>
        </div>
      </div>
    </div>
  );
}

function getOutputConsumer(messageConsumer : (message : string) => void,
                           wordsConsumer : (words : IdValue<string>[]) => void,
                           statusConsumer : (status : string) => void,
                           logConsumer : (level : LogLevel, message : string) => void) : (outputMessage : OutputMessage) => void {
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
        console.log(JSON.stringify(outputMessage.state));
        break;
      case "Log":
        logConsumer(outputMessage.level, outputMessage.message);
        break;
      default:
        throw new Error("Unsupported OutputMessage Type: " + outputMessage.type);
    }
  }
}

export default App;
