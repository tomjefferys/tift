import { loadFromYaml } from "./enginebuilder";
import { Engine } from "./engine";

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
`

//export interface Engine {
//    getWords : () => string[];
//    submit: (command : string[]) => string;
//}

export function getEngine() : Engine {
  console.log("hello");
  const engine = loadFromYaml(data);
  console.log("loaded");
  return engine;
    //return {
    //    getWords : () => ["one", "two", "three", "four"],
    //    submit : (command : string[] ) => "Submitted: " + command.join(" ")
    //}
}