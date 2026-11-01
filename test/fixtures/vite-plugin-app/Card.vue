<script setup lang="ts">
import brand from "virtual:brand";
defineProps<{ label?: string }>();
</script>
<template><section class="card"><h1>{{ label || brand }}</h1></section></template>
<style scoped>.card { width: 320px; padding: 24px; color: rgb(12, 34, 56); background: rgb(230, 240, 250); }</style>
