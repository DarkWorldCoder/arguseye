<script setup lang="ts">
import { ref } from 'vue';
defineProps<{title: string; price: number}>();
const count = ref(0);
</script>
<template>
  <article class="card"><h2>{{ title }}</h2><p>{{ price }}</p><button @click="count++">Add ({{ count }})</button></article>
</template>
<style scoped>
.card { background: rgb(240, 248, 255); padding: 16px; }
h2 { color: rgb(0, 80, 120); }
</style>
