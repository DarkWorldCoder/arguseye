# Product: why Arguseye exists

Arguseye is eyes for coding agents and developers: see a component, change it, and inspect the consequences without starting the application or writing stories.

Version scope: 0.0.17 skips inferred JSX wrappers with unresolved runtime inputs, preserves explicit incomplete-context evidence, and refreshes repaired layout chains. Version 0.0.16 adds native Node/Python/PHP/Ruby template previews, JSON context profiles, template right-click actions and explicit failed-font evidence. It retains 0.0.15’s plain-script widgets, project-owned Next.js browser polyfills, explicit reduced-motion evidence for static captures and bounded image decoding. It includes 0.0.14's project inspection, explicit setup, revised MCP/boundary contracts, project Vite compatibility, deterministic fixtures, session controls, optional inspection and HTML/Web Components. Older 0.0.12 installations do not contain these additions. See [conformance and explicit limits](conformance.md); registry availability is verified separately from source and package checks.

## What is implemented

- Your actual React/Next.js browser component, Vue 3 SFC or Svelte component, using the project's packages and Chromium. React Router and Remix browser components use the project's memory data router.
- Literal props from real JSX and Vue template usages, including aliases and local barrel re-exports. Runtime values remain explicitly unresolved.
- Global styles, Tailwind v3/v4, PostCSS, Sass, CSS modules, assets, and statically reconstructable layout wrappers. Incomplete context is reported.
- Warm browser pages and per-module compilation. Unsaved editor buffers update the live page; React refresh and Vue template/style updates preserve state. Vue script edits and Svelte edits reset state with a warning.
- MCP and CLI render evidence: PNG, accessibility snapshot, resolved inputs, source fingerprint, timing, warnings and errors. Responses can omit images.
- Project inspection through MCP `inspect_project` and CLI `doctor --json`: selected root, installed framework versions and actionable configuration diagnostics, available before browser startup. The native compiler does not execute the project's Vite plugins.
- Optional explicit JSX provider wrappers and Vue app setup, using project packages and the same unsaved source as the preview. Results identify the setup file. Vue verification recreates plugin state; see [setup contracts and boundaries](setup.md).
- Immutable baselines and before/after comparisons of pixels, dimensions, accessibility snapshots and errors. Comparisons report change or incomplete evidence, never automatic correctness.
- Virtual-plugin approximations remain incomplete across warm renders. Comparisons distinguish new and resolved warnings while preserving sampled/unresolved input provenance; repaired context does not retroactively validate an incomplete baseline.
- Paginated usage rendering, with a maximum of 12 isolated variants per batch and an incremental source index.
- A VS Code panel with export/usage selection, typed React prop controls, viewport presets, capture and comparison controls. Verification uses the shared renderer and unsaved source.
- Imported root Next Google font variables can reuse the project's matching cached font faces from `.next/static`. This does not download or compile fonts; absent cached font assets remain unresolved.
- Visible portaled dialogs and menus are included in captures and accessibility text. Canvas pixels are included in the PNG and canvas dimensions are reported separately; bounded canvas settling adds latency and reports unsettled dimensions.
- Static captures request reduced motion before project code runs and report the preference. Applications must implement that preference themselves; captures do not automatically scroll. Image decoding and fonts settle for at most one second, with unfinished work reported explicitly. See [rendering contracts](rendering.md).

## Product constraints

Warm render p95 must stay at or below 100 ms over 20 measured renders on a documented machine. The physical edit-to-pixels target is 50 ms and remains a separate display benchmark. Live-edit tests enforce a strict 100 ms bound from a ready source buffer to notification of the expected visible DOM mutation; headless frame-observation delay is reported separately. New work on either path needs a timing assertion.

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

## Native template previews (0.0.16+)

Native template workers share the existing HTML renderer and evidence contracts. Context is explicit JSON, and includes/layouts use the real engine. VS Code adds URI-aware editor/tab/Explorer context actions, engine/profile controls and a JSON context editor. See [the tested scope and limitations](templates.md); these additions require 0.0.16 or later. Unknown engines require a native adapter and their own conformance evidence.
