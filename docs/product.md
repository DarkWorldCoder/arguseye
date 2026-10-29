# Product: why Arguseye exists

Arguseye is eyes for coding agents and developers: see a component, change it, and inspect the consequences without starting the application or writing stories.

## What is implemented

- Your actual React/Next.js browser component or Vue 3 SFC, using the project's packages and Chromium.
- Literal props from real JSX and Vue template usages, including aliases and local barrel re-exports. Runtime values remain explicitly unresolved.
- Global styles, Tailwind v3/v4, PostCSS, Sass, CSS modules, assets, and statically reconstructable layout wrappers. Incomplete context is reported.
- Warm browser pages and per-module compilation. Unsaved editor buffers update the live page; React refresh and Vue template/style updates preserve state. Vue script edits reset state with a warning.
- MCP and CLI render evidence: PNG, accessibility snapshot, resolved inputs, source fingerprint, timing, warnings and errors. Responses can omit images.
- Immutable baselines and before/after comparisons of pixels, dimensions, accessibility snapshots and errors. Comparisons report change or incomplete evidence, never automatic correctness.
- Paginated usage rendering, with a maximum of 12 isolated variants per batch and an incremental source index.
- A VS Code panel with export/usage selection, typed React prop controls, viewport presets, capture and comparison controls. Verification uses the shared renderer and unsaved source.
- Imported root Next Google font variables can reuse the project's matching cached font faces from `.next/static`. This does not download or compile fonts; absent cached font assets remain unresolved.

## Product constraints

Warm render p95 must stay at or below 100 ms over 20 measured renders on a documented machine. The edit-to-pixels target is 50 ms; current live-edit tests enforce a looser 100 ms bound. New work on either path needs a timing assertion.

App modules are transformed with oxc; Vue SFCs use the project's matching compiler. Dependencies are pre-bundled by Rolldown. CSS processing uses the project's toolchain and Lightning CSS where appropriate. Browser pages stay warm. Chromium provides the rendering engine; the VS Code webview is the interactive human view.

Render failures return `errors: string[]`. Invalid IDs and inputs name the offending value. Source fingerprints describe files read by this preview session, not the whole application's external state. Successful rendering can still be incomplete because of runtime props, provider gaps, or unsettled assets.

## Where this competes

Storybook's MCP exposes component discovery, previews and testing. Playwright MCP provides browser interaction, snapshots and screenshots. Preview.js established the instant editor-preview workflow. MCP support or unsaved previewing alone is not a unique claim.

Our focus is the combination of direct source rendering, discovered usage inputs, low-latency local feedback, compact evidence, and edit verification without authored stories or an application server. These are product goals to validate against real projects, not claims of universal compatibility or competitive superiority.

References checked on 2026-10-27:
- https://storybook.js.org/docs/ai/mcp/api
- https://playwright.dev/docs/getting-started-mcp
- https://previewjs.com/docs/faq
- https://vuejs.org/guide/scaling-up/tooling.html#lower-level-packages

## Validation and next boundaries

`npm test` covers server HTTP, updates/timing, headless rendering, MCP contracts and installed fixtures. `npm run test:vscode` checks the panel workflow in the real extension host. `npm run benchmark` records the same fixture-edit task through our MCP and Playwright MCP plus Vite. Raw results and limitations live in `benchmarks/latest.json`; no fixed speedup or token saving is promised.

The MVP is local. Next.js server execution, Nuxt application context, arbitrary provider reconstruction, backend/auth-dependent states, agent interaction scripting, cloud review and team dashboards remain outside this release. See README.md for the exact compatibility limits and setup commands.

## State (2026-10-29)
Added: render inside the call site's parent box (`list_usages` context, `render_component in_context`, `frame`), states before capture (`actions`, `storage`), function props (`$fn`), `NEXT_PUBLIC_*` env, Next app-router previews on Next's vendored React canary, settled-frame capture (fonts, images). Verified on WiseAdmit: Footer, Navbar and the 641-line AIEcosystem section render with no errors. Cold starts on a large provider chain are 7–32 s per new package set: next is a one-time project-wide package warm-up at server start, then automatic `changes` on re-render, layout facts with refs, element→source. See docs/agent-wishlist.md.

## Performance (2026-10-29, WiseAdmit latest-front, 1,197 files)
Before: warm-up 32 s and skipped, first render 11–13 s, server 1.8–2.8 GB. After: ready 2–11 s, first render 1.5 s, section 0.9 s, warm 0.3 s, server ~500–750 MB. Levers: crawl once per file version, bundle worker process, cjs-module-lexer, package CSS inlined, minified bundles, modulepreload graph, route page pre-warm, usage index in warm-up, barrel rewrite, eager lazy images. Still open: server memory (transform cache + usage index + bundles in memory), V8 code cache via a persistent browser profile, HTTP/2 for module fetches.
