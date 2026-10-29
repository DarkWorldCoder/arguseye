<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ label: string; used: number; total: number; unit: string }>();
const percent = computed(() => Math.round((props.used / props.total) * 100));
</script>
<template>
  <section class="meter">
    <header><span class="label">{{ label }}</span><span class="pct">{{ percent }}%</span></header>
    <div class="track"><div class="fill" :style="{ width: percent + '%' }" /></div>
    <p class="detail">{{ used }} of {{ total }} {{ unit }} used</p>
    <button>Upgrade storage</button>
  </section>
</template>
<style scoped>
.meter { width: 360px; padding: 24px; border-radius: 24px; background: #fff; border: 1px solid #e4e4e7; box-shadow: 0 20px 40px rgba(161, 161, 170, 0.3); }
header { display: flex; justify-content: space-between; align-items: baseline; }
.label { font-weight: 700; font-size: 18px; }
.pct { font-weight: 700; font-size: 32px; letter-spacing: -0.02em; color: #42b883; }
.track { margin-top: 14px; height: 10px; border-radius: 99px; background: #eef2f1; overflow: hidden; }
.fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #42b883, #35495e); }
.detail { margin: 12px 0 0; color: #71717a; font-size: 14px; }
button { margin-top: 18px; height: 40px; width: 100%; border-radius: 12px; border: 1px solid #42b883; background: #fff; color: #2f8a63; font-weight: 700; font-size: 14px; }
</style>
