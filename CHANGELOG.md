# Changelog

## Unreleased

- Vite apps: providers set up in `src/main.tsx` around `<App />` (React Query, Redux and other `createRoot(...).render(...)` wrappers) apply to every preview, including module-level values passed to them (`const queryClient = new QueryClient()`) and side-effect imports such as `import "./i18n"`.
- `React.lazy`, Suspense boundaries and `fetch` calls a component starts on mount are waited for (up to 3 s) before the capture, so the result shows the loaded state instead of the fallback; a warning says when the cap was hit.
- `vite.config` aliases (string `find`, `path.resolve(__dirname, ...)`, `fileURLToPath(new URL(..., import.meta.url))`), `define` and `envPrefix` are read statically; `import.meta.env` has the mode flags and the exposed env variables. `REACT_APP_*` variables reach `process.env`.
- JSX in `.js` files; JSON imports export the parsed value (and top-level keys); the project's CommonJS `sass` build compiles.
- A component that renders nothing visible for the given props comes back with a warning that says so.
- A package that cannot be bundled (an import it needs is not installed, a broken entry) no longer fails every component: it is set aside and only its importers fail, with an error that names the package and the missing import. Found on shadcn's Taxonomy app, where one such package turned all 67 components into "Build failed with 2 errors".
- `next/font/google` and `next/font/local` work in any component (fonts defined in `lib/fonts.ts`, a layout rendered on its own), not only in the root layout: loaders return `className`, `variable` and `style` like Next's, and local font files load for real.
- An exported object of components (`export const Icons = {...}`) gets an error that says so and names a member to render; `export: "Icons.logo"` renders it. The audit counts such exports as skipped.
- `console.error` output during a render comes back as `console` in the result and in the MCP text, where apps often say why they failed (for example which env variable is missing).
- A Next layout file renders the way the app uses it: the layout chain down to it (providers, elements, `<html>`/`<body>` classes) around its children. Before, React took over the page's `<html>`/`<body>` and the next renders on that page failed.
- A compound part that throws "must be used within `XProvider`" (Radix, shadcn) is rendered inside `XProvider` when its own file exports it, with a warning that says so.
- Sample props: a model type from a package or generated code (Prisma, API clients) becomes an object, `Pick<Model, "a" | "b">` keeps its keys, and `Date` props and fields named like `createdAt` get a real `Date` (`{ "$date": iso }`, also accepted in `props`). Vue previews revive `$fn` and `$date` props too.
- Audited on shadcn's Taxonomy app (67 components, MIT): 3 rendered before these changes, 40 render now; the rest are compound roots that are empty on their own, one icon map, and one import of a package the copy does not install.
- Vue apps: what `src/main.ts` installs on the app (Pinia, vue-router, vue-i18n, Element Plus and other plugins, global components, directives, `app.provide`) is installed on the preview too, by running the entry with `createApp(App)` replaced and `.mount()` dropped. Components render inside `<Suspense>`, so a top-level `await` and async components resolve; `<Teleport>` content is captured. `test/fixtures/vue-edge-app` covers 13 cases.
- SvelteKit components: `$app/stores`, `$app/state`, `$app/navigation` (calls resolve without leaving the component), `$app/environment`, `$app/paths` and `$app/forms` (`use:enhance` keeps the form on the page) have browser stand-ins; `$env/static/public` and `$env/dynamic/public` come from the project's env files (`kit.env.publicPrefix`); `$lib` and `kit.alias` resolve; the root `+layout.svelte`'s global CSS applies. `test/fixtures/sveltekit-app` covers 10 cases.
- Deterministic captures: JavaScript animations (charts drawing in, springs) are waited out before the capture, so rendering the same component twice gives the same frame (`changes.status: "unchanged"`); a warning names animations still running after 2.5 s.
- Diffs use a perceptual colour threshold (YIQ, as pixelmatch) so antialiasing noise is not a change, and report `changedRegion`, the box where pixels changed.
- Requests a component makes that fail (`GET /api/me → 404`, network errors) come back as `failedRequests` with a warning, so a loading or error state in the capture is explained.
- Every framework waits for `fetch` calls made on mount (React, Vue and Svelte share one request tracker), up to 3 s, with a warning when the cap is hit.
- `arguseye audit [DIR]` and the `audit_components` MCP tool render every component once with sample props and report what renders, what throws and what comes out empty.
- The MCP server sends instructions to connecting agents on when to use it, so they reach for it after UI edits without being told.
- `test/fixtures/edge-app`: 35 kinds of component in one Vite app with real libraries (React Query, Redux Toolkit, Zustand, i18next, Recharts, Framer Motion, react-window, lodash, Sass), all rendering in `test/browser/edge.test.ts`.

## 0.0.10

- Canvas capture waits for stable CSS and drawing-buffer dimensions, including delayed ResizeObserver measurements; bounded settling reports a warning if the canvas remains unsettled. Canvas settling has its own latency cost.

- WebGL and canvas components (React Three Fiber, charts): the capture waits until every canvas's drawing buffer matches its on-screen size and has drawn; results list `canvases` (their content is only in the PNG).
- Svelte: the project's `svelte.config.(js|mjs|cjs)` `compilerOptions` apply (e.g. `experimental.async`), and components with a top-level `await` are captured once their content appears.
- Tested against Storybook's own renderer test components (React, Vue 3, Svelte 5; MIT, in `test/fixtures/storybook-cases`) with the args and checks from Storybook's stories: state, a form submit with delayed state, raw HTML, an unrenderable component reported as an error, `$effect`, top-level `await`, Options API with an imported stylesheet.
- Dialogs, menus, popovers and toasts rendered in a portal on `<body>` are part of the capture and the accessibility snapshot (`portals` in the result). Before, an open Radix/shadcn dialog came back as an empty snapshot and a crop of its trigger.
- An unknown `usage` id names the usages that exist; the CLI prints `error: ...` instead of a Node stack trace.
- `scripts/benchmark-real.mjs`: real MUI, Mantine, Chakra, styled-components, Radix, React Router, Svelte, Vue and Next.js components over MCP (cold, warm p50/p95, edit to pixels, image and text tokens). Results in benchmarks/README.md.
- Svelte 5 (and 4) components: compiled with the project's own `svelte/compiler` (TypeScript scripts, runes, scoped styles, `<style lang="scss">` through the CSS pipeline), mounted with Svelte's `mount`, previewed in VS Code, and their call sites in `.svelte` markup found with literal props (runtime ones reported unresolved). Edits remount; component state resets.
- React Router 7, 6.4+ and Remix v2 components render inside the project's own memory data router, so `Link`, `NavLink` and router hooks work. `@remix-run/react` routes through the project's router; `Meta`, `Links`, `Scripts` and friends render nothing.

## 0.0.9

- `theme: "light" | "dark"` on `render_component`, `render_usages`, `arguseye shot --theme` and a Theme picker in the VS Code panel. `dark` adds the `dark` class to `<html>`, sets `color-scheme` and (headless) emulates `prefers-color-scheme`; `light` removes the class; without it the app renders as written. Baselines record the theme, so `render_diff` compares like for like.

## 0.0.8

- An agent's edit on disk is no longer hidden by a usage lookup. `render_usages`, `list_usages` and the export lookup read the edited file before the render checked for changes, so the render showed the old component and Tailwind never generated the edit's new classes (`render_diff` then reported "unchanged"). Found by a Claude Code session that refused to call its task done.
- `render_diff` and `arguseye diff` replay the baseline's parent box: a baseline rendered `in_context`, inside a `frame`, or with actions or storage is re-rendered the same way. Before, the after-render dropped them, so an unchanged component in context reported ~100% changed pixels. Found by a second Claude Code session, which checked the PNG hashes and called the number wrong.
- Screenshots are cropped to the component's width as well as its height: a 340 px card is captured 340 px wide instead of as wide as the viewport (about a quarter of the pixels, so fewer image tokens for agents). Frames and in-context renders keep their parent box.

## 0.0.6

- Live preview no longer blinks text while you type: `@font-face` rules keep their own stylesheet, so an edit that regenerates the CSS (for example a new Tailwind class) does not recreate and reload the fonts.
- `render_component`, `render_usages`, `list_usages`, `describe_props` and `arguseye shot` pick the file's component when no export is named: the default export, else the first PascalCase export. Named-export components no longer need `--export`.

## 0.0.5

- npm package carries `mcpName` for the official MCP Registry; `server.json` on the 2025-12-11 schema.

## 0.0.4

- Reconstruct imported root Next Google font variables using matching cached font faces from the project's `.next/static` build; keep missing font context visible.
- Add genuine VS Code captures of WiseAdmit's responsive section and unsaved-edit comparison, plus CSCA.ai's existing hero, feature cards, and exam-information grid.
- Clarify the Windows x64, macOS Apple Silicon, and Linux x64 release targets and the screenshot validation platform.

## 0.0.3

- Publish the CLI and MCP server as `@ayushniroula/arguseye`; generated client configuration, documentation, skills, plugins, and release automation use that registry package while the extension retains `ayushniroula.arguseye`.

- Fix Marketplace screenshots by serving real VS Code and component images from public Pages URLs instead of the private repository.
- Interactive product site, expandable README setup guides, accessible SVG workflow and comparison illustrations, and public installation/compatibility/benchmark documentation.
- npm release archive includes its documentation and visual assets; release manifests and lockfile agree on 0.0.3.

## 0.0.2

- Gemini CLI install target; required function props get a stand-in in sample props; Marketplace publishing through trusted publishing; project site at darkworldcoder.github.io/arguseye.

## 0.0.1 (unreleased)

First public version.

- Headless renderer, MCP server (`render_component`, `list_usages`, `render_usages`, `describe_props`, `render_diff`) and CLI (`shot`, `usages`, `serve`, `mcp`, `install`).
- Real props from call sites (through barrels and aliases), props schema and samples from TypeScript, function props as `{"$fn": …}`.
- Fidelity: root and nested layouts and templates with their providers, global CSS, Tailwind v3/v4, Sass, CSS modules, assets, `NEXT_PUBLIC_*`, Next's vendored React, `next/link`, `next/image`, `next/navigation` shims, Vue single-file components.
- States: `actions` before capture, `storage`, viewports, parent box (`in_context`, `frame`), `changes` since the last render.
- Speed: one transform per file version, worker-process dependency bundling with an on-disk cache, modulepreload, route pre-warm, barrel import rewrite, eager lazy images.
- VS Code panel: follow the active file, live updates with state kept, props form, Fit / 1:1, usage and viewport pickers, baseline compare.
- Installers for Claude Code, Codex, Cursor, Windsurf, VS Code / Copilot, Antigravity; Agent Skill; Claude Code and Antigravity plugin manifests.
