<script setup lang="ts">
import { defineAsyncComponent } from "vue";
const Heavy = defineAsyncComponent(() => import("./HeavyPart.vue"));
</script>
<template><section><Heavy /></section></template>
