<script setup lang="tsx">
import { ref } from "vue";
const count = ref(3);
// Vue JSX inside an SFC, rendered with Vue's own jsx-runtime.
const Label = () => <em class="jsx-label">JSX label {count.value}</em>;
</script>
<template><span><Label /></span></template>
