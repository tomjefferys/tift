<script setup lang="ts">
const props = defineProps<{
    word: string;
}>();
const emits = defineEmits<{
    (e: 'selected', word: string): void;
}>();
function selectWord(event: Event) {
    alert(props.word);
}
</script>

<template>
    <button @click="$emit('selected', word)">{{word}}</button>
</template>

<style scoped>

</style>