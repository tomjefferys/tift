import { BasicEngine, Engine } from "./engine";
import { LogLevel, OutputConsumer, OutputMessage, Word } from "tift-types/src/messages/output";
import { InputMessage } from "tift-types/src/messages/input"
import { BiConsumer, Consumer } from "tift-types/src/util/functions";
import * as EngineProxy from "./engineproxy";
import { Filters } from "tift-types/src/util/duplexproxy";
import * as StateMachine from "./util/statemachine";
import { ControlType } from "tift-types/out/messages/controltype";
import { getDefaultGameBehaviour } from "./builder/behaviour";

type StateMachine = StateMachine.StateMachine<InputMessage, EngineProxy.DecoratedForwarder>;
type StateName = StateMachine.StateName;
type State = StateMachine.State<InputMessage, EngineProxy.DecoratedForwarder>;

/**
 * Main method for getting an engine
 * @param outputConsumer a function to consume messages produced by the engine
 * @returns a new TIFT engine
 */
export function getEngine(outputConsumer : OutputConsumer) : Engine {
  return new BasicEngine(getDefaultGameBehaviour(), outputConsumer);
}


/**
 * Creates a proxied engine
 * Proxy's allow filters and other functionality to be placed between the engine and the client, eg to handle restarts and colour scheme changes
 * @param engineBuilder a function that creates an engine, when passed an OutputConsumer
 * @returns 
 */
export function createEngineProxy(engineBuilder : (outputConsumer : OutputConsumer) => Engine) {
  return EngineProxy.createEngineProxy(engineBuilder);
}

export function createCommandFilter(name : string, action : Consumer<EngineProxy.MessageForwarder>) : Filters<InputMessage, OutputMessage> {
  return EngineProxy.createWordFilter("option", name, action);
}

export function createControlFilter(name : string, action : Consumer<void>) : Filters<InputMessage, OutputMessage> {
  return EngineProxy.createWordFilter("control", name, _forwarder => action());
}

export function createStateMachineFilter(...machines : EngineProxy.MachineInfo[]) {
  return EngineProxy.createStateMachineFilter(...machines);
}

export function buildStateMachine(initialState : StateName, ...states : [StateName, State][]) : StateMachine {
  return StateMachine.buildStateMachine<InputMessage, EngineProxy.DecoratedForwarder>(initialState, ...states);
}

export function handleInput(message : InputMessage) : EngineProxy.InputHandler {
  return new EngineProxy.InputHandler(message);
}

export function word(id : string, value : string, type : "option" | "control", tags = undefined ) : Word {
  return { id, value, type, tags }
}

export namespace Input {
  export function getNextWords(command : string[]) : InputMessage {
    return {
        type : "GetWords",
        command : command
    };
  }

  export function execute(command : string[]) : InputMessage {
    return {
        type : "Execute",
        command : command
    }
  }

  export function getStatus() : InputMessage {
    return {
        type : "GetStatus"
    }
  }

  export function load(data : string) : InputMessage {
    return {
      type : "Load", 
      data : data
    }
  }

  export function start(saveData? : string) : InputMessage {
    return { type : "Start", saveData };
  }

  export function config(properties : {[key:string] : boolean | number | string}) : InputMessage {
    return { type : "Config", properties : properties };
  }

  export function reset() :InputMessage {
    return { type : "Reset" };
  }

  export function undo() : InputMessage {
    return { type : "Undo" };
  }

  export function redo() : InputMessage {
    return { type : "Redo" };
  }
}

/**
 * Build a custom output consumer, with custom consumers provided for each message type
 * Default no-op implementations are provided by default
 */
export class OutputConsumerBuilder {

  messageConsumer? : Consumer<string>;
  wordsConsumer? : BiConsumer<string[], Word[]>;
  statusConsumer? : Consumer<string>;
  logConsumer? : BiConsumer<LogLevel,string>;
  saveConsumer? : Consumer<string>;
  controlConsumer? : Consumer<ControlType>;
  defaultConsumer : Consumer<OutputMessage> = _message => { /* do nothing */ };

  withMessageConsumer(messageConsumer : Consumer<string>) : OutputConsumerBuilder {
    this.messageConsumer = messageConsumer;
    return this;
  }
  
  withWordsConsumer(wordsConsumer : BiConsumer<string[], Word[]>) : OutputConsumerBuilder {
    this.wordsConsumer = wordsConsumer;
    return this;
  }

  withStatusConsumer(statusConsumer : Consumer<string>) : OutputConsumerBuilder {
    this.statusConsumer = statusConsumer;
    return this;
  }

  withLogConsumer(logConsumer : BiConsumer<LogLevel,string>) : OutputConsumerBuilder {
    this.logConsumer = logConsumer;
    return this;
  }

  withSaveConsumer(saveConsumer : Consumer<string>) : OutputConsumerBuilder {
    this.saveConsumer = saveConsumer;
    return this;
  }
  
  withControlConsumer(controlConsumer : Consumer<ControlType>) : OutputConsumerBuilder {
    this.controlConsumer = controlConsumer;
    return this;
  }

  withDefaultConsumer(defaultConsumer : Consumer<OutputMessage>) {
    this.defaultConsumer = defaultConsumer;
    return this;
  }


  build() : OutputConsumer {
    return message => {
      switch(message.type) {
        case "Print":
          this.messageConsumer? this.messageConsumer(message.value) : this.defaultConsumer(message);
          break;
        case "Words":
          this.wordsConsumer? this.wordsConsumer(message.command, message.words) : this.defaultConsumer(message);
          break;
        case "Status":
          this.statusConsumer? this.statusConsumer(message.status.title) : this.defaultConsumer(message);
          break;
        case "SaveState": 
          this.saveConsumer? this.saveConsumer(JSON.stringify(message.state)) : this.defaultConsumer(message);
          break;
        case "Log":
          this.logConsumer? this.logConsumer(message.level, message.message) : this.defaultConsumer(message);
          break;
        case "Control":
          this.controlConsumer? this.controlConsumer(message.value) : this.defaultConsumer(message);
          break;
        default:
          throw new Error("Unsupported OutputMessage Type2: " + message.type);
      }
    }
  }
}