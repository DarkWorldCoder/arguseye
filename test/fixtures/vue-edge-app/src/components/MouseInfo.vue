<script setup lang="ts">
import { useWindowSize } from "@vueuse/core";
const { width } = useWindowSize();
</script>
<template><p>Window {{ width > 0 ? "measured" : "unknown" }}</p></template>
