<script setup lang="ts">
import StatusBar from "./StatusBar.vue";
//@ts-ignore
import { IdValue } from '@engine/shared.ts'
import { ref, onUpdated } from "vue";
import type { OutputEntry } from "@/outputentry";

const props = defineProps<{
    status : string,
    text: OutputEntry[],
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
        <p v-for="output in text" class="outputPara">
            <span v-if="output.type == 'message'" class="message" v-html="output.message"></span>
            <span v-if="output.type == 'command'" class="command">&gt; {{output.command}}</span>
        </p>
        &gt; <span v-for="word in command" class="command">{{word.value}}&nbsp;</span>
    </div>
</template>

<style scoped>

#textout {
  height: 90%;
  overflow: auto;
  max-width: 70ch;
  margin: 0 auto

}

.message {
    color: lightgray
}

.command {
    color: lightgreen
}

.outputPara {
    /*max-width: 20ch;*/
    text-align: left;
}
</style>