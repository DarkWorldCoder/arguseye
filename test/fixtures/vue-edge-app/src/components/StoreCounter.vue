<script setup lang="ts">
import { useCounter } from "@/stores/counter";
const counter = useCounter();
</script>
<template><button @click="counter.inc()">Store count {{ counter.count }}</button></template>
