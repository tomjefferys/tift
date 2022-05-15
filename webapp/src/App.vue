<script setup lang="ts">
import Controls from './components/Controls.vue'
import Output from './components/Output.vue'
import { reactive } from 'vue';
//@ts-ignore
import * as Engine from '@engine/main.ts';

const engine = Engine.getEngine();
//alert(engine);

const state = reactive({ 
  command: [""],
  //words: ["hello", "north", "stir"]
  words: engine.getWords()
  });

function wordSelected(word: string) {
  state.command.push(word);
}
</script>

<template>
    <div id="mainFrame">
      <div id="outputArea">
        <Output />
      </div>
      <div id="inputArea">
        <Controls :command="state.command" :words="state.words" @wordSelected="wordSelected"/>
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
