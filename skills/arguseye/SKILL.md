---
name: arguseye
description: Preview React (incl. React Router and Remix), browser-renderable Next.js, Preact, Solid, Vue 3 (incl. Nuxt) Svelte 5 (incl. SvelteKit), HTML/Web Components, and native Django/Jinja/Handlebars/PHP/Ruby templates in development builds from project source without starting the app. Use to inspect UI edits, literal-prop usage variants, component states and visual differences through Arguseye MCP tools or its CLI. Reports missing context; use application-level browser tests for complete journeys.
---

# Arguseye

Render component source in Chromium with the project's packages, styles, assets and statically reconstructable layouts. Inspect a cropped PNG, accessibility snapshot, resolved inputs, warnings and errors. The application server and authored stories are unnecessary; project dependencies and a compatible Chromium browser are still required. Startup and warm render times vary with the project; read the returned timings.

## When to use it
- After editing a component: render it again; the result says what changed (`changes`) since the last render of the same target.
- For a shared component: inspect relevant call-site variants with `render_usages`, following pagination when broader coverage is needed. Use `usage` plus `in_context: true` to reconstruct its parent elements.
- When a component needs a state: pass `actions` (click, hover, fill, press, scroll, wait) and `storage` (localStorage/sessionStorage flags). Storage seeds do not reconstruct a backend or an authenticated application journey.
- When a component has no usage yet: `describe_props` gives the schema and sample props; `frame` gives it a parent box of a chosen size and background.
- After a refactor, a dependency upgrade or a change to shared styles: `audit_components` renders every component once and lists which throw and which come out empty.

## Tools (MCP server `arguseye`)
| Tool | Use |
|---|---|
| `inspect_project {}` | Check the selected application root, installed framework versions and missing/computed configuration before browser startup. Read each diagnostic's recovery advice. This does not test a browser mount or execute Vite plugins. |
| `render_component {file, engine?, profile?, export?, usage?, props?, viewport?, theme?, in_context?, frame?, actions?, storage?, fixtures?, inspection?, timeoutMs?, output?}` | Render with a discovered usage or explicit props. `viewport`: `mobile`, `tablet`, `desktop` or `WxH`. `theme`: `light` or `dark` forces the colour scheme (the `dark` class on `<html>`, `color-scheme`, `prefers-color-scheme`); check both when the app has a dark mode. Without supplied inputs, required props may be generated from TypeScript samples. |
| `list_usages {file, export?}` | Every call site with literal props, unresolved runtime props, and the JSX ancestors (`context`). |
| `render_usages {file, export?, viewport?, theme?, cursor?, limit?, output?}` | A page of isolated literal-prop variants, not full-page integration tests. `limit` is 1–12; pass the returned `nextCursor` as `cursor` until it is null. |
| `describe_props {file, export?}` | Props from the TypeScript type, with sample values. |
| `audit_components {dir?, limit?, cursor?}` | Render a bounded page under `dir` with sample props. Follow `nextCursor` using the same root and directory; changed source invalidates it. |
| `render_diff {baselineId, output?}` | Compare current code with a successful render's `captureId`, reusing resolved props and viewport. Returns before/after/highlighted images and change evidence. |

Function props are passed as `{ "$fn": "(x) => ..." }`, dates as `{ "$date": "2026-01-15T10:30:00Z" }`. Paths are relative to the project root the server was started with.

For render tools, `output` is `"image"`, `"summary"` or `"both"` (default). Use summary for a compact text response, image for visual inspection, or both when needed. Structured evidence remains available separately from image bytes.

## Native templates (development builds)

Template adapters are on `feat/template-previews`, not in published 0.0.15. Use a build containing them and native compilation mode. Supply `engine` when needed and JSON `props` as context; an optional `profile` selects project-owned preview data. A Python/PHP/Ruby project does not need React or `package.json`. Install its real engine/runtime dependencies; do not substitute another engine with similar delimiters. `inspect_project` reports declared template configuration before runtime execution.

For example, `render_component {file:"templates/card.html",engine:"django",props:{name:"Ada"},output:"both"}` renders native Django. Capture its ID, edit the template or partial, and use `render_diff` to reuse the resolved data and viewport. Review `template` engine/runtime versions, actual dependencies and unresolved lookups as well as `errors` and `warnings`. Failed or still-loading fonts remain incomplete evidence. When lookup tracing is unavailable, preserve the warning even if the HTML looks correct.

VS Code template edits remount the document and reset interactive state. Explicit setup registers project filters/helpers; views, request handlers, auth and database state are not reconstructed. Built-in loaders honor unsaved buffers and canonical roots; executable template/setup code is trusted local code, not an OS sandbox. Unknown engines need a native adapter and conformance evidence. See [the native template guide](https://github.com/DarkWorldCoder/arguseye/blob/feat/template-previews/docs/templates.md) for tested engines, configuration and limits.

## What it handles without setup
Providers from the root layout or from `src/main.tsx` (React Query, Redux, i18n set up by a side-effect import, theme providers), Vue plugins installed in `src/main.ts` (Pinia, vue-router, vue-i18n, Element Plus, directives, `app.provide`), `<Suspense>`, top-level `await` and `<Teleport>` in Vue, SvelteKit's `$app/*`, `$env/*`, `$lib` and `kit.alias`, auto-imports and auto-registered components (`unplugin-auto-import`, `unplugin-vue-components`, Nuxt's declaration files), Nuxt composables and built-in components (data calls return their `default` in a preview), Next's `next/router`, `next/head`, `next/dynamic`, `next/headers` and async server components, `React.lazy`/Suspense and data loaded on mount (the capture waits for them, up to 3 s), animations, charts and WebGL canvases, portals (dialogs, menus, toasts), virtualized lists, JSX in `.js`, tsconfig paths and `vite.config` aliases, `import.meta.env`/`define`, CSS modules, Sass, Tailwind v3/v4, JSON and image imports, custom elements. A component that renders nothing for the given props comes back with a warning instead of a blank image.

## Reading a result
- For context static analysis cannot reconstruct, use an existing `arguseye.setup.tsx` default wrapper accepting `children` (React/Preact/Solid), or `arguseye.setup.vue.ts` default function receiving the Vue app. These replace inferred providers/plugins while retaining inferred global CSS. Create the file before server startup; existing files accept unsaved edits. Read `setupApplied` in the result. For Svelte, `arguseye.setup.svelte.ts` returns a fresh context Map. Setup runs trusted project code and does not restore a backend. Saved config/setup changes invalidate the next verification; refresh the live panel after adding a setup file.
- MCP results include `schemaVersion: 1` and `errors[]`, even for requests that fail before producing evidence. Inspect `isError` and `errors` before using tool-specific fields. Text-only clients can pass the printed `captureId` back to `render_diff`.
- `errors[]` are real: a resolve error names the import and the importer; a render error carries the component stack. Fix them before trusting the pixels.
- Read `warnings[]`, `unresolved[]`, `propsSource` and `complete` before trusting context. Generated samples are not real application data; provider gaps, runtime values or unsettled assets can make a successful render incomplete.
- `changes` and explicit diffs report `unchanged`, `changed` or `incomplete`, with pixel, accessibility and error evidence. None of these establishes that the intended behavior is correct.
- `newWarnings` and `resolvedWarnings` distinguish current context from repaired failures. A comparison stays incomplete if its baseline was incomplete even when `after.complete` becomes true; capture a new baseline. Replayed generated/sample inputs retain their original provenance. Virtual plugin stand-ins remain warnings across warm renders; they do not become real plugin output after caching.
- `timings` (prepare, show, settle, capture) tell you whether a slow render is loading, rendering or waiting for images.
- `layoutsApplied` and `contextApplied` list the layouts/templates and the call-site ancestors the component was wrapped in.
- `sourceRevision` fingerprints files read by this preview session, not the whole application's external state or a Git commit.

## Baselines and comparison limits

Successful renders return an immutable `captureId`. The renderer retains at most 64 captures, four warm pages, 16 previous results and 64 MiB of retained PNGs; byte-budget eviction can occur before 64 captures. Thus restarting the server or eviction makes an old ID unavailable. Capture again when the error names an unknown or expired baseline.

An explicit `render_diff` also replays fixtures and inspection requests when supplied. It replays the baseline's file, export, resolved props, viewport, theme, `frame`, `in_context` parent box, `actions` and `storage` (since 0.0.8), so a stateful or contextual baseline compares like for like. It does not restore the live editor's interaction state. Next.js server execution, Nuxt context and arbitrary runtime providers require the application environment.

## Reproducible and deeper checks

- `fixtures` can fix `now`, `randomSeed`, `locale`, `timezoneId`, and exact network responses. It uses a fresh browser context, including module initialization. Example: `{"now":"2026-01-01T00:00:00Z","randomSeed":42,"network":{"policy":"block-unmatched","responses":[{"url":"/api/user","contentType":"application/json","body":"{\"name\":\"Example\"}"}]}}`. Read `fixtureProvenance` and actual `environment`. Timers, crypto randomness and server state remain real. Baselines store fixture bodies and storage; avoid sharing credentials.
- Pending animation frames remain stability warnings. `scheduledTimers` counts application/dependency timers without treating housekeeping as failure. A comparison that varies with unchanged source/inputs while timers remain scheduled is incomplete; engine deadlines, Vite transport and cancelled timers do not count.
- MCP cancellation propagates to in-flight rendering. `timeoutMs` bounds execution (30 s default, 120 s maximum). Cancelled pages are discarded; retry to continue. Node config code is trusted and is not an OS sandbox.
- `inspection: {accessibility:true,sources:true}` adds axe violations, checks needing review, and bounded element references. Read `errorLocations.original` where available. An owning component file is not an exact source line, and unavailable maps stay explicit. No violations do not prove accessibility conformance. Inspect `timings.inspection` separately.
- Native mode remains default. Plugin-dependent virtual SVGs/macros need the project's own installed Vite/plugins and `--build-mode vite` on the MCP command. This executes trusted config in a separate process, not the app entry/backend; compatibility edits reload and reset state. A native stand-in stays incomplete. Read `build` provenance; restore baselines using the same compiler mode.
- Existing `.html` files use an independent native adapter. Real module scripts and Lit/Web Components use project packages; no React is needed. With one custom element, props become properties; with several, pass its tag as `export`. Undefined elements and pending updates remain warnings. Classic `<script>`s run in document order before modules, on a fresh page per render. Closed/nested async shadow work and server templates require integration checks.
- A plain-script widget (a `.js`/`.cjs` file with no `import`/`export`: an embed or IIFE script such as a chat bubble) renders by passing its file: it runs as a classic script on a fresh page per render, so globals and "already loaded" guards never leak between renders. The capture and snapshot include what it mounts on `<body>` and in open shadow roots; closed shadow roots are a warning (image only). `props` become `window.__ARGUSEYE_WIDGET_CONFIG__`, and `data-*` props become attributes on its `<script>` (`document.currentScript.dataset`). For widgets that read a named global (`window.intercomSettings`) or need a host element, render a small `.html` page with that config `<script>` or host `<div data-…>` before `<script src="widget.js">`. Errors carry the script's file and line; failed requests stay warnings. Native build mode only.
- Pixel changes use a 0.1 YIQ noise threshold, so subtle color differences may not count. Inspect before/after images; unchanged never proves correctness.

## Without MCP (CLI)
```bash
npx @ayushniroula/arguseye shot src/components/Card.tsx --export Card --usage app/page.tsx:12 --in-context --out card.png
npx @ayushniroula/arguseye usages src/components/Card.tsx --export Card
npx @ayushniroula/arguseye serve src/components/Card.tsx --export Card --port 4321
npx @ayushniroula/arguseye audit src/components --out audit.json
npx @ayushniroula/arguseye doctor --root . --json
```

Use `shot --fixtures inputs.json`, `--accessibility`, `--sources` and `--timeout-ms N` for explicit deeper checks. Use `shot --json` for structured metadata and `--output summary` to omit the ordinary PNG output. CLI baselines survive separate commands when explicitly saved in a chosen directory:

```bash
npx @ayushniroula/arguseye shot src/components/Card.tsx --export Card --capture-dir /tmp/arguseye-before --json --output summary
# Edit the component in the same project, then compare:
npx @ayushniroula/arguseye diff --baseline /tmp/arguseye-before --out /tmp/arguseye-diff --json
```

The baseline directory contains `capture.json` and `capture.png`; comparison writes `before.png`, `after.png`, `diff.png` and `diff.json`. The same replay limits apply to saved CLI baselines.

## Workflow
1. `list_usages` for the component you changed.
2. `render_component` with the first usage and `in_context: true`; read `errors`, then the snapshot, then the PNG.
3. Edit; render the same target again and read `changes`.
4. Inspect relevant `render_usages` pages when the component is shared; report incomplete context and the variants actually checked.
