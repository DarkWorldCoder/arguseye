<script lang="ts">
  let { start = 0 }: { start?: number } = $props();
  let count = $state(start);
</script>

<button onclick={() => count++}>Count: {count}</button>
