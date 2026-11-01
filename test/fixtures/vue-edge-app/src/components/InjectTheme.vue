<script setup lang="ts">
import { inject } from "vue";
const theme = inject<{ accent: string }>("theme");
</script>
<template><p :style="{ color: theme?.accent }">Accent from app.provide</p></template>
