# Explicit preview setup

Use setup when Arguseye cannot reconstruct the providers or plugins a component needs. Setup is optional and runs your project's own browser code and packages. It does not start your application server, restore a backend, or execute the project's Vite plugins.

Run `npx @ayushniroula/arguseye doctor --root . --json` first, or call MCP `inspect_project {}`. Confirm that the selected root is the application package and read installed-version and configuration diagnostics. Inspection does not execute setup or launch Chromium.

Inferred JSX wrappers with unresolved runtime attributes or spreads are skipped, rather than mounted with missing inputs (for example, a dashboard shell that requires an authenticated tenant). Reconstructable providers, host elements and global styles still apply. The warning names the skipped wrapper, layout and expressions; evidence remains incomplete. The VS Code status and expandable context details expose the same gap. Use an explicit setup to supply the real context your component needs. Errors in the target component or explicit setup still appear as render errors.

## JSX providers

Create `arguseye.setup.tsx` in the selected project root. Its default export is a wrapper component accepting `children`. This replaces inferred provider/layout wrappers; global styles and root classes still come from the application's detected entry. Reuse real provider modules rather than copying their implementation.

```tsx
import { ThemeProvider } from "./src/providers/ThemeProvider";

export default function PreviewSetup({ children }) {
  return <ThemeProvider theme="light">{children}</ThemeProvider>;
}
```

`.jsx`, `.ts` and `.js` alternatives are supported in that priority order after `.tsx`. Use the syntax and runtime of your project: React, Preact or Solid. The root's declared dependencies determine the JSX runtime; mixed-runtime packages need separate application roots. The render result's `setupApplied` and `layoutsApplied` identify the explicit wrapper. Provider state and effects still require review; supplying a wrapper does not establish full-app fidelity.

## Vue plugins and injection

Create `arguseye.setup.vue.ts` (or `.js`) at the selected root. Its default export receives the actual Vue app, may be async, and installs preview plugins and context. It replaces inferred installation from `src/main`; global CSS remains inferred. Do not call `createApp` or `mount` here.

```ts
import { createPinia } from "pinia";
import { i18n } from "./src/i18n";
import "./src/styles/global.css";

export default function setup(app) {
  app.use(createPinia());
  app.use(i18n);
  app.provide("theme", { accent: "#0e7490" });
}
```

Verification renders recreate the Vue app and its setup. Interactive template/style updates keep state; script and setup dependency updates reset it. Setup failures appear in warnings and leave evidence incomplete even if the component mounts.

## Svelte mount context

Create `arguseye.setup.svelte.ts` (or `.js`) in the selected root. Its default export returns a fresh `Map` for Svelte's mount context. It may be async. The same contract works with Svelte 5 `mount` and the Svelte 4 component constructor.

```ts
export default function setup() {
  return new Map([["theme", { accent: "#0e7490" }]]);
}
```

This supplies explicit context without starting SvelteKit loaders or reconstructing a backend. Each verification mount gets fresh context. Svelte live edits currently remount and reset state.

## Editing and boundaries

Saved setup and manifest changes invalidate compilation at the next verification render. Refresh the live panel after adding a new setup file. Existing setup files and their imports participate in source fingerprints and unsaved buffer updates. Keep them inside the selected project or an explicitly approved source root. The engine rejects symlinks that escape approved roots.

Application loaders, auth, network effects and server behavior still require application-level validation. Native preview and the opt-in project Vite pipeline have separate performance costs and limits; see [rendering contracts](rendering.md).
