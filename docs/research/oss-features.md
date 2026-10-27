# OSS features worth adopting (research, Oct 2026)

Scope: what other open-source previewers, dev servers, agent-vision tools and visual-regression tools do that fits our positioning (AI-first, keystroke speed, exact design, real props). Effort: S = a day, M = a week, L = more. "have" = already in `src/`.

What we have today: `render_component` (viewport presets, props override, usage id), `list_usages`, `render_usages`, PNG cropped to the component, aria snapshot, `errors[]` with stacks (`pageerror`), warm page swapped with `__CP__.show`, Fast Refresh with state kept, root-layout CSS + `<html>/<body>` attributes, Tailwind v3/v4, SCSS, assets, Rolldown dep pre-bundle in memory. Not yet: `render_diff` (promised in `docs/product.md`, not in code), Vue, VS Code panel, dark mode, interaction, a11y, click-to-source, on-disk dep cache.

## 1. Preview.js (archived Mar 2026)
- **Props generated from TypeScript types**: `type-analyzer` resolves the props type and fills valid values on demand. Fallback when a component has no usage yet. Why: an agent writing a new component still gets a picture. Effort M. https://github.com/fwouts/previewjs/tree/main/type-analyzer
- **Storybook stories as variants**: detects CSF stories in the codebase without setup and lists them next to the component. Why: existing stories are free, hand-curated states. Effort S (static export scan reuses `findUsages`). https://previewjs.com/docs/faq
- **`__previewjs__/Wrapper.tsx`**: one file for global CSS, providers, router. Why: the escape hatch when provider detection fails; agents can write it. Effort S. https://previewjs.com/docs/config/wrapper
- **Virtual filesystem for unsaved text**: source served from an in-memory FS updated as you type (have, via buffer edits). https://previewjs.com/docs/faq
- **Components detected with the TypeScript Compiler API** (we use oxc; keep). Lesson: the project died from maintenance load of 5 frameworks, so stay on React/Next/Vue.

## 2. Storybook
- **argTypes / control inference**: control type from initial value, react-docgen for TS, `options` → select, name matchers (`/(background|color)$/i` → color, `/Date$/` → date), `if:` conditional controls. Why: cheap, typed "variant knobs" for both panel and agent (`props` arg already exists). Effort M. https://storybook.js.org/docs/essentials/controls
- **Args in the URL** (`?args=size:100;style:rounded`, `!null`, `!date(...)`). Why: shareable, diffable state; our preview URL could carry props the same way. Effort S. https://storybook.js.org/docs/writing-stories/args
- **Decorators with context** (global → component → story order; receive args/globals/parameters). Why: provider/theme wrapping per usage. Effort M. https://storybook.js.org/docs/writing-stories/decorators
- **Interaction tests (`play`, `step`, `userEvent`, `fn()` spies)**. Why: agents need "click, then look" more than a static shot. Effort M (we have Playwright: `actions: [{click: role/name}]` before capture). https://storybook.js.org/docs/writing-tests/interaction-testing
- **a11y addon**: axe-core; violations / passes / incomplete; highlight violating elements; `test: 'off' | 'todo' | 'error'`. Why: a text list of violations is token-cheap and actionable. Effort S (axe-core injected into the warm page). https://storybook.js.org/docs/writing-tests/accessibility-testing
- **Measure + outline** (`m` key shows margin/padding/border/size; outline every box). Why: for the human panel; for agents, the same data as JSON boxes. Effort S. https://storybook.js.org/docs/essentials/measure-and-outline
- **MCP toolset (10.6)**: `stories-changed` (affected by local edits, reverse-dep graph), `stories-find-by-component`, `docs-list`/`docs-show` (props + first 3 stories from a components manifest), `stories-preview` (MCP Apps inline render), `test-run` (incl. a11y) with "how to fix" hints, `review-create`. Why: the `stories-changed` idea = our `render_usages` driven by git diff; `docs-show` = typed props summary. Effort M. https://storybook.js.org/docs/next/ai/mcp/overview

## 3. Ladle
- **`meta.json`**: static index of every story with `filePath`, `locStart`/`locEnd`, statically-analysable `meta` (e.g. `browsers`). Why: an agent/CI can enumerate render targets without booting anything; our `list_usages` already returns ids, a project-wide `list_components` JSON is the same move. Effort S. https://ladle.dev/docs/meta
- **`?mode=preview` + `[data-storyloaded]`**: chrome-less render plus a "ready" attribute for screenshots. Why: same contract our page needs for stable capture (have, implicitly; make it explicit). Effort S. https://ladle.dev/docs/visual-snapshots
- **Addon state persisted in the URL** (width, theme, rtl, mode). Why: a URL is a reproducible state an agent can hand to a human. Effort S. https://ladle.dev/docs/addons
- **Theme / RTL / width toggles** with Axe a11y addon; one command, one dependency, Vite + code-splitting per story. https://ladle.dev/

## 4. Histoire (Vue)
- **Variants + visual profiles**: `<Variant>` per state; visual testing profiles with `width/height`, `colorScheme`, `deviceScaleFactor`, `backgroundColor`, `textDirection`; capture waits for fonts and two identical frames, animations disabled. Why: the exact capture recipe for "exact design". Effort S (we pause animations; add fonts.ready + double-frame check + colorScheme). https://histoire.dev/guide/visual-testing.html
- **MCP tools (2026)**: `histoire_list_stories` (with `revision`), `histoire_get_preview`, `histoire_capture_screenshot` (PNG via `artifactUri`), `histoire_inspect_variant` (state + prop metadata), `histoire_inspect_dom` (subtree, attributes, text, computed styles), `histoire_inspect_accessibility` (ARIA snapshot), `histoire_get_runtime_diagnostics` (console, page errors, failed requests), job polling for long ops. Why: closest OSS peer to our MCP; `inspect_dom` + `runtime_diagnostics` are the two we lack. Effort S each. https://histoire.dev/guide/mcp.html
- **`hst-*` controls bound to reactive `setup()` state**, `initState` per variant. Why: how Vue variants should work when we add Vue. Effort M. https://histoire.dev/guide/vue3/controls.html
- **Props matrix** (workbench): grid of prop combinations. Why: "render all states" in one image for an agent. Effort M. https://histoire.dev/guide/workbench.html

## 5. Stagewise / Agentation (feedback on the running app)
- **Agentation annotation payload**: click an element → CSS selector, position/bounding box, class names, React component tree on hover, note; multi-select, text/area selection, animation pause, shadow roots/iframes, "open source location in editor"; delivery by clipboard, local MCP server (`agentation-mcp`), SSE/webhook, Claude Code hook that injects pending annotations. Why: defines the "context an agent expects about an element": selector + box + component + source. Effort S to emit the same shape from our snapshot. https://github.com/benjitaylor/agentation
- **Stagewise**: built-in browser, DOM selection as agent context, agent gets tab console + debugger, SKILL.md project instructions, inline diffs to accept/undo. Why: console access and element-as-context are table stakes. Effort S (console). https://docs.stagewise.io/

## 6. React DevTools MCP / React Grab / LocatorJS / click-to-component
- **react-devtools-mcp**: `get_component_tree`, `search_components`, `get_owners_list`, `get_element_source`, `inspect_element` (props/state/hooks/context), `override_props/state/hooks`, `toggle_error`/`toggle_suspense`, `get_errors_and_warnings`, `highlight_element`, `capture_screenshot`. Why: `toggle_error`/`toggle_suspense` render error and loading states with no props; `override_*` is live state editing. Effort M (needs the DevTools hook in the warm page). https://github.com/skylarbarrera/react-devtools-mcp/blob/main/TOOLS.md
- **React's own `react-devtools-cdt-mcp` (2026)**: page library registering `react_get_component_tree`, `react_find_components`, `react_get_component_by_dom_element`, `react_get_owner_stack`, `react_get_component_source`, profiling tools; stable short uids (`r12`). Why: the official shape for "component by DOM node"; we could register the same tool group in our page. Effort M. https://react.dev/reference/dev-tools/react-devtools-cdt-mcp
- **React Grab**: hover + ⌘C copies `[<a class=..>…</a> in LoginForm (at components/login-form.tsx:46:19)]`; primitives for hit-testing, page freezing, editor navigation. Why: one-line element→source format agents already know. Effort S (map DOM → fiber `_debugSource`/owner in our page). https://github.com/aidenybai/react-grab
- **click-to-component / LocatorJS**: Option+click opens `vscode://file/path:line:col`; Option+right-click shows the parent component stack with props; data from `@babel/plugin-transform-react-jsx-source`. Why: the VS Code panel's click-to-source. Effort S (oxc keeps jsx source info; our transform runs anyway). https://github.com/ericclemmons/click-to-component

## 7. Vite + vite-plugin-inspect
- **Dep pre-bundle cache on disk** (`node_modules/.vite`, keyed by lockfile hash, patches mtime, config fields, `NODE_ENV`; `--force`; re-optimise and reload when a new dep appears; `immutable` cache headers with a version query). Why: our Rolldown bundle is rebuilt per process; caching it makes the cold start as fast as the warm one. Effort S. https://vite.dev/guide/dep-pre-bundling
- **`server.warmup` / pre-transform** of likely files at startup. Why: first render of a usage after startup hits no transform waterfall. Effort S. https://vite.dev/config/server-options
- **Error overlay with code frame** (file:line:col, source-mapped). Why: our `errors[]` should carry a code frame too, not just a stack. Effort S.
- **vite-plugin-inspect**: per-module transform chain with timing and module graph. Why: a `--why` / `explain_render` that shows what was transformed and how long each step took, for our own perf work and for agents debugging a missing style. Effort M. https://github.com/antfu/vite-plugin-inspect

## 8. Visual regression: Loki, reg-suit / reg-cli
- **reg-cli diff knobs**: `matchingThreshold` (YIQ per-pixel), `thresholdRate`, `thresholdPixel`, `enableAntialias`, JSON report `{failedItems,newItems,deletedItems,passedItems}`, HTML report. Rust→WASM diff engine. Why: `render_diff` needs a number, not two images; antialias tolerance stops font-hinting noise. Effort S (pixelmatch-style). https://github.com/reg-viz/reg-cli
- **Loki**: per-configuration `width/height/deviceScaleFactor/mobile/media/features`, `chromeSelector` crop, `diffOnly` approve, Docker for determinism. Why: named capture profiles. Effort S. https://loki.js.org/configuration.html
- **reg-suit**: expected images keyed by git hash, PR comment notifier. Why: later, CI mode. Effort L. https://github.com/reg-viz/reg-suit

## 9. Playwright: ariaSnapshot & toHaveScreenshot
- **ARIA snapshot YAML** (`- role "name" [checked]`, regex names, `/children: contain|equal|deep-equal`, partial matching). Have the snapshot; adopt `toMatchAriaSnapshot` semantics for `render_diff` text mode. Effort S. https://playwright.dev/docs/aria-snapshots
- **Playwright MCP snapshot refs** (`[ref=e5]`, `browser_snapshot {target, depth, boxes}`, `browser_find text|regex`). Why: refs let an agent say "click e12" without selectors; `boxes` gives layout numbers the a11y tree lacks. Effort S. https://playwright.dev/mcp/snapshots
- **toHaveScreenshot options**: `animations: 'disabled'`, `caret: 'hide'`, `mask`, `stylePath`, `scale: 'css'|'device'`, `threshold 0.2`, `maxDiffPixels/Ratio`, stable only after two identical captures. Have animations+caret; add mask/stylePath/scale/stability. Effort S. https://playwright.dev/docs/api/class-pageassertions
- **Chrome DevTools MCP**: `take_snapshot` (a11y tree with uids), `take_screenshot {format, quality, fullPage, uid}`, `emulate {colorScheme, prefersReducedMotion, forcedColors, networkConditions, cpuThrottlingRate}`, `list_console_messages` with source-mapped stacks. Why: the emulate set is exactly "dark mode / reduced motion / forced colors" for exact design. Effort S. https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md

## 10. 2025–2026 "agent sees UI" tools
- Storybook MCP, Histoire MCP, React's cdt-mcp, Agentation 2.0 (MCP, Layout Mode), Stagewise, Onlook (DOM edits → code, component detection), Faster Fixes / Yocoolab (feedback widgets with screenshot + selector + component tree), Expo community MCPs (`take_screenshot` via Maestro). None renders from source without a running app: that gap is ours. Common denominators to match: a11y tree with ids, element bounding boxes, console/page errors, component→source, colorScheme emulation, PNG-or-text choice per call.

## Top 12: what to build next
1. **`render_diff` with a real diff** (S): before/after PNG + pixel count/ratio with antialias tolerance (reg-cli) + aria diff (Playwright children semantics). Promised in product.md, exists nowhere else; the self-check that makes an agent trust its own edit.
2. **Interaction before capture** (M): `actions: [{click|hover|fill|press, ref|role+name}]` in `render_component`, Storybook `play` shape, refs from the snapshot (Playwright MCP). Agents need hover/open/error states; the real app needs 6–10 calls for this.
3. **Color scheme + media emulation** (S): `colorScheme`, `prefersReducedMotion`, `forcedColors` (Chrome DevTools MCP `emulate`, Histoire profiles). Dark mode is half of "exact design" and a one-line Playwright call on the warm page.
4. **Runtime diagnostics in every result** (S): console messages + failed requests next to `errors[]` (Histoire `get_runtime_diagnostics`, Stagewise console). A missing image or 404 font is a visual bug an agent cannot see in a PNG.
5. **Snapshot refs + boxes** (S): `[ref=e5]` ids and viewport-relative bounding boxes on the aria snapshot, `find` by text (Playwright MCP, Agentation). Gives layout numbers token-cheaply and feeds items 2 and 7.
6. **Element → source** (S): `inspect_element(ref)` returning `in Card (at components/card.tsx:46:19)` (React Grab format) plus computed styles (Histoire `inspect_dom`); also click-to-source in the VS Code panel. Closes the loop from pixel to file.
7. **Dep bundle cache on disk** (S): Vite's `node_modules/.vite` keyed by lockfile/config hash, plus warmup of the usage's file. Cold start becomes as fast as warm; speed is the product.
8. **Stories as variants** (S): CSF stories listed next to usages in `list_usages`. Real props from code (ours) + hand-curated states (theirs), no Storybook server (Preview.js, Storybook `docs-show`).
9. **axe-core a11y pass** (S): `a11y: true` returns violations with the offending ref (Storybook a11y addon, Ladle). Text-only, cheap, and lets agents fix what a screenshot never shows.
10. **Error / loading states on demand** (M): `toggle_error`, `toggle_suspense` and `override_props` through the DevTools hook (react-devtools-mcp). States no call site passes, with no mock code.
11. **Capture stability recipe** (S): `document.fonts.ready`, two identical frames, `mask`, `stylePath`, `scale: 'device'` (Playwright, Histoire). Removes flaky diffs before item 1 lands in CI.
12. **Props from types when no usage exists** (M): typed defaults and `control` inference (Preview.js type-analyzer, Storybook argTypes), exposed as `props_schema` in `list_usages`. Keeps "real props" first while still rendering brand-new components.

Have already: cropped PNG + aria snapshot, errors with stacks, viewport presets, warm page swap, Fast Refresh with state, in-memory dep pre-bundle, root layout CSS, animations paused + caret hidden. Deferred: Vue variants (Histoire controls) until Vue rendering lands; CI mode with git-keyed baselines (reg-suit); `explain_render` transform trace (vite-plugin-inspect).
