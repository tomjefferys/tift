import { loadFromYaml } from "./enginebuilder";
import { Engine } from "./engine";
import { OutputConsumer } from "./messages/output";
import { InputMessage } from "./messages/input"

const data = `
---
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

export function getEngine(outputConsumer : OutputConsumer) : Engine {
  const engine = loadFromYaml(data, outputConsumer);
  return engine;
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
}