<template><span>API {{ base }} ({{ mode }})</span></template>
<script setup lang="ts">
const base = import.meta.env.VITE_API_BASE;
const mode = import.meta.env.MODE;
</script>
