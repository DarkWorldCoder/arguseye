<script setup lang="ts">
import type { MetadataProps } from "./MetadataProps";
withDefaults(defineProps<MetadataProps>(), { tone: "quiet", count: 2 });
defineEmits<{ save: [id: string] }>();
defineSlots<{ default(props: {title: string}): any }>();
</script>
<template><h1>{{title}} / {{tone}} / {{count}}</h1></template>
