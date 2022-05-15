<script setup lang="ts">
  import { reactive } from 'vue'

  const state = reactive({ status : "This is the status bar"});
</script>

<template>
    <div id="statusBar">
        {{ state.status }}
    </div>
</template>

<style scoped>

#statusBar {
    border: 2px solid yellow;
}
</style>