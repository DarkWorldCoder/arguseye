# Explicit preview setup

Use setup when Arguseye cannot reconstruct the providers or plugins a component needs. Setup is optional and runs your project's own browser code and packages. It does not start your application server, restore a backend, or execute the project's Vite plugins.

Run `npx @ayushniroula/arguseye doctor --root . --json` first, or call MCP `inspect_project {}`. Confirm that the selected root is the application package and read installed-version and configuration diagnostics. Inspection does not execute setup or launch Chromium.

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

## Editing and boundaries

Create setup files before starting the MCP or editor preview; restart to discover a newly added file or change the dependency manifest. Existing setup files and their imports participate in source fingerprints and unsaved buffer updates. Keep them inside the selected project or an explicitly approved source root. The engine rejects symlinks that escape approved roots.

There is no explicit Svelte context adapter in this slice. The existing Svelte/SvelteKit support remains limited to its documented browser stand-ins and inferred global styles. Application loaders, auth, network effects, computed configuration and arbitrary build plugins still require application-level validation. Native preview performance and full-plugin compatibility are separate concerns.
