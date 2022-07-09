<script setup lang="ts">
//@ts-ignore
import { IdValue } from '@engine/shared.ts'

const props = defineProps<{
    word: IdValue;
}>();
const emits = defineEmits<{
    (e: 'selected', word: string): void;
}>();
function selectWord(event: Event) {
    alert(props.word);
}
</script>

<template>
    <button @click="$emit('selected', word)">{{word.value}}</button>
</template>

<style scoped>

</style>