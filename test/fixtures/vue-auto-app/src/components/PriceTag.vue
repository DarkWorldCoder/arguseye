<script setup lang="ts">
const props = defineProps<{ amount: number }>();
const label = computed(() => `$${props.amount.toFixed(2)}`);
</script>
<template><b>{{ label }}</b></template>
