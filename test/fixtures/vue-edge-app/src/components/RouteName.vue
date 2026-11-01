<script setup lang="ts">
import { useRoute } from "vue-router";
const route = useRoute();
</script>
<template><nav><RouterLink to="/settings">Settings</RouterLink> <span>Route ready: {{ route ? "yes" : "no" }}</span></nav></template>
