<script setup lang="ts">
  import { reactive } from 'vue'
  const props = defineProps<{
      status: string
  }>();
</script>

<template>
    <div id="statusBar">
        {{ status }}
    </div>
</template>

<style scoped>

#statusBar {
    border: 2px solid yellow;
}
</style>