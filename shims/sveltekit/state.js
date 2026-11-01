// $app/state (Svelte 5): the page at "/", not navigating.
export const page = { url: new URL("/", location.origin), params: {}, route: { id: "/" }, status: 200, error: null, data: {}, form: null, state: {} };
export const navigating = { from: null, to: null, type: null, willUnload: null, delta: null, complete: null };
export const updated = { current: false, check: async () => false };
