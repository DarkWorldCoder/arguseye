<script setup lang="ts">
// No imports: ref, computed, dayjs, useWindowSize and useGreeting are auto-imported.
const count = ref(2);
const doubled = computed(() => count.value * 2);
const { width } = useWindowSize();
const greeting = useGreeting("Asha");
const date = dayjs("2026-01-15").format("D MMM YYYY");
</script>
<template><p>{{ greeting }}: {{ count }} doubled is {{ doubled }}, {{ date }}, window {{ width > 0 ? "measured" : "?" }}</p></template>
