// $app/stores outside SvelteKit: the page at "/", not navigating, no update pending.
import { readable } from "svelte/store";

const current = () => ({ url: new URL("/", location.origin), params: {}, route: { id: "/" }, status: 200, error: null, data: {}, form: null, state: {} });
export const page = readable(current());
export const navigating = readable(null);
export const updated = { ...readable(false), check: async () => false };
export const getStores = () => ({ page, navigating, updated });
