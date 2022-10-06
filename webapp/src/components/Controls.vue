<script setup lang="ts">
import { ref, computed } from 'vue';
import Command from "./Command.vue";
import Word from "./Word.vue";

const props = defineProps<{
    command: string[],
    words: string[]
}>();

const emit = defineEmits<{
  (e: 'wordSelected', word: string) : void,
  (e: 'execute') : void
}>();


const combinedCommand = computed(() => "command:" + props.command.join(" "));

//const command = ref("");

function wordSelected(word: string) {
    //command.value += " " + word;
    emit('wordSelected', word);
}
</script>

<template>
    <div id="commandOut">
        <Command :command="combinedCommand"/>
        <div id="execute">
            <button @click="$emit('execute')">execute</button>
        </div>
    </div>
    <div class="textout">
        <TransitionGroup name="words">
            <div v-for="word in words" :key="word">
                <Word :word="word" @selected="wordSelected"/>
            </div>
        </TransitionGroup>
    </div>
</template>

<style scoped>
.words-move, 
.words-enter-active,
.words-leave-active {
  transition: all 0.5s ease;
}
.words-enter-from,
.words-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.words-leave-active {
  position: absolute;
}
</style>