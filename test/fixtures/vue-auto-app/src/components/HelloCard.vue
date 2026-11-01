<script setup lang="ts">
defineProps<{ title: string }>();
</script>
<template><article><h3>{{ title }}</h3><slot /></article></template>
