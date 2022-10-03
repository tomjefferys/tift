<script setup lang="ts">
import Controls from './components/Controls.vue'
import Output from './components/Output.vue'
import { reactive } from 'vue';
//@ts-ignore
import { getEngine, Input } from '@engine/main.ts';
//@ts-ignore
import { Engine } from '@engine/engine.ts'
//@ts-ignore
import { OutputConsumer, OutputMessage } from '@engine/messages/output.ts'
//@ts-ignore
import { IdValue } from '@engine/shared.ts'

const adventure = `
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
`;

const output : OutputMessage[] = [];
const engine : Engine = getEngine((message: OutputMessage) => output.push(message));

const state = reactive({ 
  command : [] as IdValue[],
  words : [] as IdValue[],
  text : [] as string[],
  status : ""
  });


load(adventure);
start();
getStatus();
getWords([]);

function wordSelected(word: IdValue) {
  state.command.push(word.id);
  getWords(state.command);
}

function execute() {
  engine.send(Input.execute(state.command));
  if (output.length) {
    const values = output.map(message => message.value);
    values.forEach(value => state.text.push(value));
    output.length = 0;
  }
  state.command = [];
  getWords([]);
  getStatus();
}

function getWords(command : string[]) {
  engine.send(Input.getNextWords(command));
  for(const message of output) {
    if (message.type === "Words") {
      state.words = message.words;
    }
  }
  output.length = 0;
}

function getStatus() {
  engine.send(Input.getStatus());
  for(const message of output) {
    if (message.type === "Status") {
      state.status = message.status;
    }
  }
  output.length = 0;
}

function load(data : string) {
  engine.send(Input.load(data));
}

function start() {
  engine.send(Input.start());
}

</script>

<template>
    <div id="mainFrame">
      <div id="outputArea">
        <Output :text="state.text" :status="state.status"/>
      </div>
      <div id="inputArea">
        <Controls
            :command="state.command"
            :words="state.words"
            @wordSelected="wordSelected"
            @execute="execute"/>
      </div>
    </div>
</template>

<style>
@import './assets/base.css';

#outputArea {
  position: relative;
  height: 70%;
  border: 2px solid blue;
}

#inputArea {
  position: relative;
  height: 30%;
  border: 2px solid red;
}

#mainFrame {
  height: 100vh;
}

</style>
