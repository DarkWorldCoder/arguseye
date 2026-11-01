<script>
  import { goto, invalidateAll } from "$app/navigation";
  let clicked = $state(false);
</script>
<button onclick={async () => { await goto("/cart"); await invalidateAll(); clicked = true; }}>{clicked ? "Navigated" : "Go to cart"}</button>
