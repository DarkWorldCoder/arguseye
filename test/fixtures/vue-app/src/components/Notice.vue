<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ props: { title: String } });
</script>
<template><aside :class="$style.notice">{{ title }}</aside></template>
<style module>.notice { color: rgb(120, 0, 80); padding: 8px; }</style>
