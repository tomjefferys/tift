import { loadFromYaml } from "./enginebuilder";
import { Engine } from "./engine";
import { OutputConsumer } from "./messages/output";

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
rule: rule1
run:
  - if(random(1,2) == 1).then(print("A cold wind runs straight through you"))
`

export function getEngine(outputConsumer : OutputConsumer) : Engine {
  const engine = loadFromYaml(data, outputConsumer);
  return engine;
}