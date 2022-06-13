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
        <div v-for="word in words">
            <Word :word="word" @selected="wordSelected"/>
        </div>
    </div>
</template>

<style scoped>

</style>