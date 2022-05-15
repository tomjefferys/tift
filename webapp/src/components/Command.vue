<script setup lang="ts">
const props = defineProps<{
   command: string; 
}>();
</script>

<template>
    <div>{{ command }}</div>
</template>

<style scoped>

</style>