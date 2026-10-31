// AsyncComponent.svelte uses a top-level await, which Svelte 5 compiles only with this flag (as Storybook's sandbox sets it).
export default { compilerOptions: { experimental: { async: true } } };
