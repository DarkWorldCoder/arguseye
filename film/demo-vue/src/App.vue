<script setup lang="ts">
import UsageMeter from "./components/UsageMeter.vue";
</script>
<template>
  <UsageMeter label="Storage" :used="6.8" :total="10" unit="GB" />
</template>
