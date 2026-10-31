<script lang="ts">
  import Badge from "./lib/Badge.svelte";
  import Counter from "./lib/Counter.svelte";
  let title = "Dynamic";
</script>

<main>
  <Badge label="New" count={3} tone="warn" />
  <Badge label={title} />
  {#if title}
    <Counter start={5} />
  {/if}
</main>
