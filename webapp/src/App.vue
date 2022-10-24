<script setup lang="ts">
import Controls from './components/Controls.vue'
import Output from './components/Output.vue'
import { reactive } from 'vue';
//@ts-ignore
import { getEngine, Input } from '@engine/main.ts';
//@ts-ignore
import type { Engine } from '@engine/engine.ts'
//@ts-ignore
import type { OutputMessage } from '@engine/messages/output.ts'
//@ts-ignore
import type { IdValue } from '@engine/shared.ts'
import { message, type OutputEntry } from './outputentry';
import { command } from './outputentry';

fetch('./adventure.yaml')
  .then((response) => response.text())
  .then(data => {
    load(data);
    configure({ "autoLook" : true})
    start();
    getStatus();
    getWords([]);
    console.log("Loaded!");
  })

const output : OutputMessage[] = [];
const engine : Engine = getEngine((message: OutputMessage) => output.push(message));

const state = reactive({ 
  command : [] as IdValue[],
  words : [] as IdValue[],
  text : [] as OutputEntry[],
  status : ""
  });

function wordSelected(word: IdValue<string>) {
  state.command.push(word);
  getWords(state.command.map(word => word.id));
}

function execute() {
  engine.send(Input.execute(state.command.map(word => word.id)));
  const outputEntry = command(state.command.map(word => word.value).join(" "));
  state.text.push(outputEntry);
  handleMessages();
  state.command = [];
  getWords([]);
  getStatus();
}

function handleMessages() {
  if (output.length) {
    const values = output.map(entry => message(entry.value));
    values.forEach(value => state.text.push(value));
    output.length = 0;
  }
}

function getWords(command : string[]) {
  engine.send(Input.getNextWords(command));
  for(const message of output) {
    if (message.type === "Words") {
      if (message.words.length) {
        state.words = message.words;
      } else {
        execute();
      }
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

function configure(properties : {[key:string] : boolean | number | string}) {
  engine.send(Input.config(properties));
}

function start() {
  engine.send(Input.start());
  handleMessages();
}

</script>

<template>
    <div id="mainFrame">
      <div id="outputArea">
         <Output :text="state.text" :status="state.status" :command="state.command"/>
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
  overflow: hidden;
}

</style>
