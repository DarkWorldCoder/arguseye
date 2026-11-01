<script setup lang="ts">
import { onMounted, ref } from "vue";
const state = ref("Loading user…");
onMounted(async () => { try { const r = await fetch("/api/me"); state.value = r.ok ? "Loaded" : "Could not load user"; } catch { state.value = "Could not load user"; } });
</script>
<template><p>{{ state }}</p></template>
