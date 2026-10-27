<script setup lang="ts">
import Tile from './components/Card.vue';
const name = 'Runtime';
</script>
<template>
  <Tile title="Desk Lamp" :price="12" />
  <tile title="Cable" :price="3" />
  <Tile :title="name" :price="5" />
</template>
