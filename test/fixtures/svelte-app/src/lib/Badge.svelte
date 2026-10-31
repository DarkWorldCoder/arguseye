<script lang="ts">
  let { label, count = 0, tone = "info" }: { label: string; count?: number; tone?: "info" | "warn" } = $props();
  let doubled = $derived(count * 2);
</script>

<span class="badge {tone}" data-count={count}>{label}: {count} ({doubled})</span>

<style>
  .badge { color: var(--brand); padding: 4px 8px; border-radius: 6px; }
  .warn { background: rgb(254, 243, 199); }
</style>
