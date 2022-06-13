<script setup lang="ts">
import StatusBar from "./StatusBar.vue";

const props = defineProps<{
    status : string,
    text: string[],
}>();
</script>

<template>
    <StatusBar :status="status"/>
    <div class="textout">
        <p v-for="output in text">
           {{output}}
        </p>
    </div>
</template>

<style scoped>

</style>