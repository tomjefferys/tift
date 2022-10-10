<script setup lang="ts">
import { ref, computed } from 'vue';
import Command from "./Command.vue";
import Word from "./Word.vue";
//@ts-ignore
import { IdValue } from '@engine/shared.ts'

const props = defineProps<{
    command: IdValue<string>[],
    words: IdValue<string>[]
}>();

const emit = defineEmits<{
  (e: 'wordSelected', word: IdValue<string>) : void,
  (e: 'execute') : void
}>();


const combinedCommand = computed(() => "command:" + props.command.map(word => word.value).join(" "));

//const command = ref("");

function wordSelected(word: IdValue<string>) {
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