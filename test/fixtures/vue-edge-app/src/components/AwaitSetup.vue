<script setup lang="ts">
// Top-level await: Vue only renders this inside <Suspense>.
const user = await new Promise<{ name: string }>((r) => setTimeout(() => r({ name: "Awaited user" }), 50));
</script>
<template><p>{{ user.name }}</p></template>
