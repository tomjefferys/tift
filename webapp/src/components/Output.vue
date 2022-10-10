<script setup lang="ts">
import StatusBar from "./StatusBar.vue";
//@ts-ignore
import { IdValue } from '@engine/shared.ts'
import { ref, onUpdated } from "vue";

const props = defineProps<{
    status : string,
    text: string[],
    command: IdValue<string>[]
}>();

const textout = ref(null);

onUpdated(() => {
    if (textout.value) {
        textout.value["scrollTop"] = textout.value["scrollHeight"];
    }
})
</script>

<template>
    <div id="statusbar">
        <StatusBar :status="status"/>
    </div>
    <div ref="textout" id="textout">
        <p v-for="output in text">
           {{output}}
        </p>
        &gt; <span v-for="word in command">{{word.value}}&nbsp;</span>
    </div>
</template>

<style scoped>

#textout {
  height: 90%;
  overflow:auto;
}
</style>