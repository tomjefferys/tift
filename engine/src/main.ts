import { BasicEngine, Engine } from "./engine";
import { OutputConsumer } from "./messages/output";
import { InputMessage } from "./messages/input"


export function getEngine(outputConsumer : OutputConsumer) : Engine {
  return new BasicEngine([], [], outputConsumer, []);
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

  export function start() : InputMessage {
    return { type : "Start" }
  }

  export function config(properties : {[key:string] : boolean | number | string}) : InputMessage {
    return { type : "Config", properties : properties };
  }
}