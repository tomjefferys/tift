<script setup lang="ts">
import Controls from './components/Controls.vue'
import Output from './components/Output.vue'
import { reactive } from 'vue';
//@ts-ignore
import { getEngine } from '@engine/main.ts';
//@ts-ignore
import { Engine } from '@engine/engine.ts'

const engine : Engine = getEngine();

const state = reactive({ 
  command : [] as string[],
  words : engine.getWords([]),
  text : [] as string[],
  status : engine.getStatus()
  });

function wordSelected(word: string) {
  state.command.push(word);
  state.words = engine.getWords(state.command);
}

function execute() {
  engine.execute(state.command);
  state.command = [];
  state.words = engine.getWords([]);
  state.status = engine.getStatus();
  const output = engine.getBuffer().flush();
  if (output.length) {
    state.text.push(output.join(" "));
  }
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
