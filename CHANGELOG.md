# Changelog

## Unreleased

- Native Vue template edits retain unchanged scoped stylesheets instead of reparsing identical CSS and recreating font faces. Style changes still update CSS; script edits retain their explicit state-reset behavior.
- Explicit Vite compatibility uses the project's installed Vite, configuration and plugins in a separate process, with unsaved buffers and build-input invalidation. Native compilation stays the default. Compatibility edits reload state; generated virtual modules can now come from actual plugins rather than native stand-ins.
- Verification accepts explicit clock, seeded random, locale/timezone and bounded network fixtures, reports their provenance and blocked requests, and supports cancellation and execution deadlines. Sessions bound pages, capture count, history and retained PNG bytes; audit cursors continue bounded batches.
- Optional component-scope axe accessibility findings include incomplete checks. Original stack locations and element ownership are returned only where source evidence exists; unavailable mappings remain explicit. Vue metadata reads imported macro types through the bounded unsaved source reader.
- A separate HTML/Web Components adapter renders real module scripts, project packages, document attributes/styles and shadow DOM, including installed Lit. Explicit Svelte setup can supply fresh mount context. Unsupported document lifecycle behavior remains actionable rather than silently emulated.
- Cached dependency URLs use forward slashes on every OS, fixing Windows cache-hit 404s for nested package exports (Preact hooks, Solid and Svelte internals).
- Native Windows/macOS/Linux conformance jobs exercise framework/MCP contracts and an extracted VSIX. Portable filesystem URLs, canonical usage lookup and stable slash-separated usage/display paths cover native path differences. Configuring CI is not platform certification: retained job results and timing failures determine support evidence.
- Fixed-clock fixtures no longer hide later server errors. Pending animation-frame work remains a stability warning. Scheduled application/dependency timers are counted separately; comparisons that vary with unchanged source/inputs while timers remain scheduled are incomplete. Engine deadlines, Vite transport and cancelled timers do not count.
- Verification avoids clipped compositor resizes for bounded in-viewport boxes by losslessly cropping a viewport capture, including all device pixels covered by fractional CSS bounds. Offscreen boxes and large viewports retain direct clipped capture. Warm requests clear the prior forced color-scheme. Finite native Web Animations finish, infinite ones pause with a warning, and canvas settling uses real elapsed time independently of frame cadence. Capture-phase and module-transform timings expose measured costs; performance limits are unchanged.
- Static MCP prop/usage inspection no longer starts speculative application warm-up. A query classified as read-only cannot indirectly mount providers or execute PostCSS configuration before the agent requests a render.
- Warm stylesheet refresh works in strict pnpm layouts where PostCSS belongs to a configured plugin or declared Next/Vite build tool rather than the application root. It resolves that project's runtime through the shared resolver; no Arguseye-owned PostCSS fallback is substituted. Found by rendering and comparing CSCA.ai's existing hero from a freshly installed package.
- Virtual-module approximation warnings survive browser import caching and remain scoped to the target and Vue setup dependencies. Statically ignored computed Vite settings appear in render warnings too. Diffs report new/resolved warnings without carrying repaired provider/asset failures into the current render; replayed sampled and unresolved inputs retain their provenance.
- Prop inspection and generated samples read imported type files through the same bounded, unsaved source reader as rendering. Outside type imports are rejected instead of leaking their enum/sample values; unsaved type edits appear immediately in metadata.
- Optional `arguseye.setup.tsx` provider wrappers and `arguseye.setup.vue.ts` app setup replace inferred browser context using project packages. Existing setup files support unsaved updates and appear as `setupApplied` in evidence. Vue verification recreates plugin state; live template/style edits retain state, and setup failures remain explicit.
- `inspect_project` and CLI `doctor --json` report the selected application directory, actual installed framework packages and actionable missing-package/config diagnostics without launching Chromium or executing project configuration. MCP initializes before rendering so inspection remains available when browser setup is broken.
- MCP reports the installed build version, declares versioned output schemas for all tools, includes capture handles in text, and adds structured static-inspection and error results. Render tools conservatively declare that project code and actions may have external effects; static inspection remains read-only.
- Preview HTTP and headless target reads are bounded to canonical project paths, declared package roots, runtime shims and caller-approved extra roots. Outside and retargeted symlink requests are rejected; unexpected HTTP hosts and origins cannot read preview content.
- Agent installation updates JSONC and TOML with parser-based edits, preserving comments, other servers and custom settings. Repeated Codex installs remain valid; all selected configurations are validated before any are written, and each config is replaced atomically.

## 0.0.12

Preact and Solid join React, Vue and Svelte. Vite project support expands to `import.meta.glob`, supported Sass `additionalData` and aliases, CSS asset aliases, and Vue JSX. Plugin `virtual:` modules use empty stand-ins with warnings; this does not execute the actual plugin pipeline. Previews run in the browser: missing data and context remain warnings or errors, and captured changes require review.

- Preact projects (preact without react): JSX compiles against Preact and components render with Preact's own `render`, inside the providers `src/main.tsx` wraps the app in, with an error boundary, global CSS, signals and actions. Edits re-render (state resets). `test/fixtures/preact-app` covers it.
- Solid projects: JSX compiles with the project's own `babel-preset-solid` (from vite-plugin-solid) after oxc strips TypeScript, and components render with Solid's `render` inside an `ErrorBoundary` and the providers `render(() => <App />)` wraps the app in, created lazily so context reaches them. Signals, `Show`, `For`, resources and actions work; edits remount. `test/fixtures/solid-app` covers it.
- Vite's `import.meta.glob` (eager or lazy, `import:` option, negative patterns, aliases) expands into the object Vite produces, so routers and i18n loaders built on it load.
- `virtual:` modules from Vite plugins (`virtual:svg-icons-register`, `virtual:pwa-register`) are empty stand-ins with the imported names and a warning, instead of failing the file and the app setup that imports them.
- Sass: `css.preprocessorOptions.scss.additionalData` from vite.config is prepended as Vite does, and vite.config aliases resolve in `@use`/`@import`; CSS `url("@/assets/...")` resolves through the aliases too.
- `<script lang="tsx">` in Vue files, and `.tsx` in Vue projects, compile as Vue JSX with Vue's own jsx-runtime.
- The preview server no longer crashes when a request fails after its response has started.
- The local Geeker-Admin audit artifact (Vue 3, Element Plus, Pinia, 121 components) records 114 successful mounts, 6 errors and 1 empty result, versus 3 successful mounts in 0.0.11. This is mount coverage, not independently verified full-application visual fidelity; backend requests, data and plugin approximations remain explicit limitations.
- The capture waits for animation frames only when the app has requested one. Still components avoid that extra wait; components that request frames after mounting can take an additional frame. Timing remains subject to the documented warm-render gate.

## 0.0.11

These previews run in the browser. Framework stand-ins approximate supported APIs; they do not execute a full Next.js, Nuxt or SvelteKit server. Missing data and context remain warnings or errors. Captured changes require review.

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
- Deterministic captures of the final frame: JavaScript animations started on mount (charts drawing in, springs, count-ups) are fast-forwarded to their end by moving `requestAnimationFrame` time ahead while the capture settles, and anything still moving is waited out (two still frames, at most 2.5 s, with a warning). Before, a Recharts chart was captured with its bars at the start of the animation. Repeated renders give the same frame (`changes.status: "unchanged"`).
- MCP tools declare `readOnlyHint`, `idempotentHint`, `destructiveHint: false` and `openWorldHint: false`, so clients and registries know they only read the project.
- Diffs use a perceptual colour threshold (YIQ, as pixelmatch) so antialiasing noise is not a change, and report `changedRegion`, the box where pixels changed.
- Requests a component makes that fail (`GET /api/me → 404`, network errors) come back as `failedRequests` with a warning, so a loading or error state in the capture is explained.
- Next.js modules that only work inside Next: `next/router` (pages router: `pathname` is the route pattern, `asPath` the URL, `query` the params), `next/head` (sets the document title), `next/dynamic` (lazy with its `loading` component), `next/script` (third-party scripts do not run), `next/headers` (no cookies or headers), `next/cache` and `server-only`. `usePathname()`/`useParams()` return the route of the page the component lives on (`app/(shop)/products/[id]/page.tsx` → `/products/1`, `{ id: "1" }`), from App Router or pages-router usages.
- Async server components render: they and the async components inside their tree are called and awaited before React renders the result, as the server would.
- Auto-imports: names a file uses without importing them (`ref`, `computed`, VueUse, package defaults, project composables) are imported for it, read from the declaration file `unplugin-auto-import` or Nuxt writes (`auto-imports.d.ts`, `.nuxt/imports.d.ts`); components declared by `unplugin-vue-components` or Nuxt (`components.d.ts`) are registered on Vue previews and load on first use.
- Nuxt components render without Nuxt: its runtime (`useFetch`/`useAsyncData` return their `default` or null with a warning, `useState`, `useRoute`, `useRouter`, `navigateTo`, `useHead`, `useRuntimeConfig`, `useCookie`, `definePageMeta` and the rest) and built-in components (`NuxtLink` as an anchor, `ClientOnly`, `NuxtImg`, `NuxtLayout`) have browser stand-ins, reached through `.nuxt/imports.d.ts`, `.nuxt/components.d.ts`, `#app`, `#imports` and `#components`. A declared component whose module is not installed renders its slot. `test/fixtures/nuxt-app` covers it.
- React Fast Refresh applies only in projects that have React: in a Vue or Svelte project a `useX` composable is not treated as a hook.
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
