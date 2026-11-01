import { signal, computed } from "@preact/signals";

const items = signal(3);
const label = computed(() => `${items.value} items`);
export default function SignalBadge() { return <span>Cart: {label}</span>; }
