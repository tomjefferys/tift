import { useRef, useState, useEffect } from 'react';
import './App.css';
import { getEngine, Input } from "tift-engine"
import { Engine } from "tift-engine/src/engine";
import { IdValue } from "tift-engine/src/shared";
import { OutputMessage } from "tift-engine/src/messages/output";
import Output from "./components/Output"
import Controls from './components/Controls';


const adventure = 
`---
room: cave
desc: A dark dank cave
exits:
  north: entrance
  south: pool
tags: [start]
---
room: entrance
desc: Sunlight casts a pool of illumination over the rocky and uneven floor
exits:
  south: cave
---
room: pool
desc: A deep pool of cold clear water exends over the southern end of the chamber
exits:
  north: cave
---
item: key
name: rusty key
desc: An old rusty key
location: pool
tags: [carryable]
---
item: hotRock
name: hot rock
desc: a burning hot piece of recently solidified lava
location: entrance
tags: [carryable]
before: get(hotRock) => "Ouch!"
---
rule: rule1
run:
  - if(random(1,2) == 1).then(print("A cold wind runs straight through you"))
`

function getOutputConsumer(messageConsumer : (message : string) => void,
                           wordsConsumer : (words : IdValue<string>[]) => void,
                           statusConsumer : (status : string) => void) : (outputMessage : OutputMessage) => void {
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
      default:
        throw new Error("Unsupported OutputMessage Type: " + outputMessage.type);
    }
  }
}

function App() {
  const [command, setCommand] = useState<IdValue<string>[]>([]);
  const [words, setWords] = useState<IdValue<string>[]>([]);
  const [status, setStatus] = useState<string>("");

  // Store messages as a ref, as the can be updated multiple times between renders
  // and using a state makes it tricky to get the most up to date values
  const messagesRef = useRef<string[]>();

  const engineRef = useRef<Engine | null>(null)

  const getWords = (command : IdValue<string>[]) => engineRef.current?.send(Input.getNextWords(command.map(word => word.id)));
  const execute = (command : IdValue<string>[]) => engineRef.current?.send(Input.execute(command.map(word => word.id)));

  // Initialization
  useEffect(() => {
    messagesRef.current = [];
    const outputConsumer = getOutputConsumer(
      message => messagesRef.current = [...(messagesRef?.current ?? []), message],
      words => setWords(words),
      status => setStatus(status)
    );
    const engine = getEngine(outputConsumer);

    engineRef.current = engine;

    engine.send(Input.load(adventure));
    engine.send(Input.config({"autoLook" : true}));
    engine.send(Input.start());
    getWords([]);
    engine.send(Input.getStatus());
  }, []);

  // When words updated
  useEffect(() => {
    const engine = engineRef.current;
    if (engine && command.length && !words.length) {
      execute(command);
      engine.send(Input.getStatus());
      setCommand([]);
      getWords([]);
    }
  }, [words]);

  // When command updated
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
          <Output messages={messagesRef.current ?? []} status={status}/>
        </div>
        <div id="inputArea" className="inputArea">
          <Controls words={words ?? []} wordSelected={(event,word) => setCommand([...command, word])}/>
        </div>
      </div>
    </div>
  );
}

export default App;
