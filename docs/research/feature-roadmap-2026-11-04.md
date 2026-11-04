# Arguseye: next features grounded in the current engine

Research date: November 4, 2026. Source baseline: local package version 0.0.18. Method: source inspection, Agent Reach's Exa web search, and its GitHub CLI backend for repository metadata, licenses and selected issue reports. No external code was installed or executed. This is a proposal, not an implementation or a new conformance result.

Implementation follow-up: `feat/render-verification-evidence` adds the first render-report milestone: audit completeness, recovery diagnostics, real progress, bounded scroll traversal and optional DOM layout/used-font inspection. These additions are included in the 0.0.19 release candidate; affected-component matrices, richer interaction/network recipes and further adapters below remain proposals. See [the implemented contracts](../rendering.md#render-evidence).

## Decision

Make Arguseye better at answering **“What did this edit affect, and what evidence is missing?”** before adding many more framework names.

Recommended delivery order:

1. Accurate audit completeness, actionable render diagnostics and real progress messages.
2. Bounded scroll/reveal capture and an inspection report for layout and actual font use.
3. Affected-component verification and bounded viewport/state matrices.
4. Replayable state recipes, richer project-owned network fixtures and CI evidence bundles.
5. Additional native adapters, selected from demonstrated project failures.

These are prioritization judgments. They are not measured competitive wins or delivery estimates.

## What already exists

The older [OSS research](oss-features.md) is useful history but its “not yet” inventory is stale. Do not implement that list blindly.

| Area | Present in the inspected source | Remaining opportunity |
| --- | --- | --- |
| Rendering | React/browser Next.js, Vue, Svelte, Preact, Solid, HTML/Web Components, classic widgets; bounded native template workers | Extend fidelity and adapter conformance rather than assume all framework behavior works |
| Context | Usage props, inferred parent/layout context, explicit setup/providers, JSON template profiles | Guide repair of unresolved runtime inputs without inventing authentication/backend data |
| Verification | Immutable captures, pixel/dimension/accessibility diffs, automatic previous-render change summaries | Affected-target batches, environment compatibility, masks and multiple change regions |
| State | Click/fill/hover/keyboard actions, scrolling, storage, fixed time, seeded randomness, locale/timezone, basic network responses | Assertions, stable element refs, portal targeting, response sequences and state recipes |
| Inspection | Optional axe checks, mapped error locations, partial element-to-source evidence | Geometry, clipping, actual used fonts, style-rule provenance and editor selection |
| Performance | Warm pages, incremental transforms, dependency cache on disk, cancellation and bounded retained evidence | More complete cache identity, representative large-project performance evidence and whole-request budgets |
| Editor | Export/usage/props/viewport controls, capture/compare, unsaved updates and right-click template previews | Informative progress, visual inspector, state/matrix controls and diagnostics with repair actions |
| Agents | Structured MCP schemas, CLI JSON, project inspection, resumable mount audits | Compact artifact resources, discovery without mounting, guided next steps and a tested client compatibility matrix |

Evidence: [product scope](../product.md), [render requests/results](../../src/agent/createRenderer.ts), [fixtures](../../src/agent/renderFixtures.ts), [inspection](../../src/agent/inspectRender.ts), [MCP tools](../../src/agent/mcpServer.ts), [dependency cache](../../src/server/depBundler.ts), [native templates](../templates.md).

## Ranked additions

### 1. Guided failure recovery and honest audit results — first

Today `audit` classifies a nonempty render without runtime errors as `ok`, even when the render carries warnings. It retains the warning strings, but does not expose the render's completeness as its own audit dimension. See [audit classification](../../src/agent/audit.ts).

Add `complete`, unresolved counts and grouped diagnostic codes per entry, alongside the existing mount status. Preserve the difference between “mounted,” “empty,” “error,” and “complete evidence.” A batch must not summarize incomplete mounts as verified UI.

Extend current project/request diagnostics into render diagnostics: phase, exact file/input, observed cause, suggested next operation and whether the operation needs project configuration. Examples: supply a missing usage prop; choose a template profile; repair a font URL; author an explicit provider wrapper; switch to the existing Vite compatibility mode when a real plugin is necessary. Suggestions must cite observed evidence, not speculative automatic patches.

Add true phase messages to VS Code and MCP: “Reading component,” “Resolving imports,” “Preparing styles,” “Waiting for fonts,” “Capturing preview.” Support the client's progress token; do not simulate thinking or invent percentages. Cancellation already exists and should remain wired through. [MCP progress contract](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress).

Acceptance: incomplete provider/prop/font evidence survives audits; cancellation does not leave a success phase; concurrent request updates cannot overwrite each other; clients without progress support still receive the normal final result.

### 2. Bounded scroll/reveal capture — first

This directly addresses the kind of long, mostly blank landing-page capture reported for HYVE. It is a plausible failure mechanism to test, not a proven diagnosis of that earlier screenshot. The current contract explicitly says captures do not automatically scroll. An explicit scroll action exists, but it is a single `window.scrollTo`, not a bounded traversal of sections and nested scrollers.

Add an opt-in capture policy that advances through the page or selected scroll container, lets lazy assets and reveal observers react, settles under a deadline, then captures the requested view. Record positions visited, time spent, hidden/unsettled sections and the applied motion preference. Preserve sticky-header behavior and restore the requested final scroll position. A full-page screenshot alone must not be treated as proof that every section activated.

Do not force `opacity:1`, delete transforms or disable observers to manufacture a complete image. A reduced-motion path that the app does not implement remains incomplete evidence. Keep this slower mode outside the normal warm-render budget. [Playwright screenshot scope](https://playwright.dev/docs/screenshots), [screenshot animation behavior](https://playwright.dev/docs/api/class-page#page-screenshot).

Acceptance: viewport and nested-container reveals, lazy images, sticky/fixed elements, content-visibility, infinite feeds and scroll-linked animations; cap distance, iterations, pixels and elapsed time. Infinite content must stop with an explicit partial-coverage result.

### 3. Layout, style and actual-font evidence — first

Optional source inspection currently returns bounded selectors, text and partial component locations. Extend it with bounds, scroll/client dimensions, computed visibility, clipping ancestors, useful layout properties and matched CSS rules where trustworthy maps exist.

Report observations such as horizontal overflow or zero visible bounds. Distinguish intentional truncation and offscreen content from confirmed failures; “hidden” is evidence, not automatically a bug.

For fonts, retain existing failed/loading-face checks and add **which fonts rendered the text**, including fallback or mixed-script glyphs. Chromium's `CSS.getPlatformFontsForNode` exposes used-font information, whereas a CSS font-family declaration or loaded FontFace alone does not establish which face supplied every glyph. Query support from the installed browser and return unavailable evidence when unsupported. [Chrome protocol API](https://github.com/ChromeDevTools/devtools-protocol/blob/master/types/protocol-proxy-api.d.ts).

Acceptance: missing font, corrupt successful-HTTP font response, wrong weight, variable font, mixed Latin/Devanagari/CJK, fallback glyphs, text ellipsis, overflow, open shadow roots and portal content. Limit inspected nodes; measure this cost separately.

### 4. Verify the affected components and usages — next

Build on the existing usage index and module graph. Accept changed source paths or a Git comparison and return candidate affected components/usages, with a reason for each dependency edge. Render only bounded pages of candidates and group equivalent outcomes.

Include CSS, provider/layout, shared asset and template-include changes. Dynamic imports, runtime template names and unindexed paths must appear as coverage gaps. No impact graph can prove universal application coverage from static imports alone.

Storybook's current MCP exposes change/discovery/testing workflows; that is a useful interaction pattern to study, rather than a reason to require stories. [Storybook MCP API](https://storybook.js.org/docs/11/ai/mcp/api.md).

Acceptance: shared CSS affects multiple targets; removed/renamed files invalidate plans; unsaved buffers are included; pagination respects the existing 12-usage batch limit; identical screenshots with different unresolved inputs are not collapsed into one “verified” result.

### 5. Viewport, theme and content matrices — next

Offer named profiles and a bounded matrix: narrow/wide viewport, light/dark theme, long text, RTL, loading, empty and error states. Reuse actual usage inputs first. Additional edge-case values must be caller-authored or clearly labeled generated samples.

Return a compact per-cell table and images for selected changed/error cells; a contact sheet is optional. Do not enumerate every Cartesian combination. Let the caller choose a bounded subset or a documented pairwise strategy, with tested/skipped counts.

Histoire's variant grids and Ladle's responsive/RTL controls provide relevant UX precedents. [Histoire features](https://histoire.dev/guide/), [Ladle features](https://www.ladle.dev/).

Acceptance: long names, empty arrays, translated text, RTL, dark-theme contrast, narrow dialogs and explicit container-query sizes. Locale/timezone fixtures already exist; reuse them.

### 6. Better interaction targets, assertions and reusable recipes — next

Actions already exist. The missing feature is reliable verification of the resulting state.

The current action helper searches inside `#root` and selects the first matching locator. That makes portal content and duplicate labels important cases for the next slice. Add explicit target scope, match-count errors and bounded element references tied to a render revision; preserve access to legitimate shadow content. Stale refs should fail with a recapture instruction.

Add typed assertions for visible text, selected/expanded state, focus, count and emitted function calls. Save explicit recipe inputs/actions/assertions as versioned local data that agents and the VS Code panel both use. Do not make arbitrary code evaluation the default action API. [Current actions](../../src/agent/createRenderer.ts), [Storybook interaction workflow](https://storybook.js.org/docs/writing-tests/interaction-testing/).

Acceptance: portal menu, repeated “Save” buttons, keyboard-only dialog, stale ref after edit, event callbacks, action timeout and fresh verification state after an interactive editor session.

### 7. Reuse project network scenarios — next

Current fixtures support fixed method/URL/body responses and block or pass through unmatched requests. Extend them for response sequences, controlled delay/failure and request-body matching; GraphQL operations at one URL need more than URL identity. Explicitly cover SSE, WebSocket and service-worker behavior before claiming support.

Offer an opt-in bridge to the project's existing MSW handlers rather than maintaining a competing handler language. MSW documents REST, GraphQL and WebSocket scenarios, but integrating its browser worker requires a deliberate lifecycle and interception policy. Do not let two interception systems silently override each other. [MSW](https://mswjs.io/docs/), [GraphQL](https://mswjs.io/docs/graphql/), [handler reset/overrides](https://mswjs.io/docs/best-practices/network-behavior-overrides/).

Acceptance: loading→success, error→retry, same GraphQL URL/different operation, unmatched request and a fresh scenario after the previous handler state is exhausted. Use explicit local example data; do not import a user's live credentials or session automatically.

### 8. Trustworthy persisted baselines and review artifacts — next

CLI capture directories already persist baselines. Extend manifests with the actual browser version, OS/architecture, device scale factor, capture policy, relevant font evidence and tool/runtime identity. Compare those identities before calling a cross-session comparison complete. Existing template engine/runtime mismatch detection is a starting point, not full environment matching.

Add opt-in region masks and a reported tolerance policy; retain raw images and disclose exactly what was ignored. Split disconnected change regions so a small text edit does not require a full image. Do not hide real layout shifts behind a permissive global threshold.

Build a local HTML evidence report and machine-readable CI output on top of the shared renderer. Preserve exit states for incomplete versus observed change versus execution failure; a visual change alone is not a failed product requirement. [Current capture persistence](../../src/agent/captureFiles.ts), [current comparison](../../src/agent/compareCaptures.ts), [Playwright environment guidance](https://playwright.dev/docs/test-snapshots).

### 9. Compact agent artifacts and discovery — later

Keep existing image/summary/both behavior. Add optional resource links for retained images/reports, cropped changed regions, explicit evidence-size limits and follow-up suggestions. A resource must have a readable implementation, an expiry policy and session access checks; a URI string alone is not an artifact integration. Fall back to inline images for clients without usable resource support. [MCP tools and resource links](https://modelcontextprotocol.io/specification/2026-07-28/server/tools).

Add a paginated static component/template catalog separate from mount audits: exports, props, discovered usages, engine/profile and known gaps. Existing `.stories.*` files are excluded by the ordinary source scanner. A separate opt-in CSF adapter could reuse existing authored states without making stories a requirement. Never evaluate story modules merely to enumerate metadata without reporting that execution. [Ladle metadata/testing pattern](https://ladle.dev/docs/visual-snapshots/).

Test actual Codex, Claude Code, Cursor and VS Code clients separately from SDK transport tests. Version negotiation, cancellation, image delivery and resource reading can differ by client; “MCP compatible” is not proof that every client supports every optional feature.

### 10. More reliable cache reuse — later, or earlier if a stale render reproduces

The dependency cache already exists. Its current key includes bundler/options/specifiers and the first discovered lockfile's size and mtime. Evaluate content digests, the relevant workspace manifests, package patches, linked workspace dependencies, target conditions and runtime identity. Add an explanation of cache hits/misses and an explicit repair operation.

This is a code-inspection concern, not a reproduced stale-cache bug. Test same-size lockfile changes with preserved timestamps before declaring it fixed. Watch only meaningful inputs; do not hash a whole repository per render. [Current cache key](../../src/server/depBundler.ts), [Vite cache inputs](https://vite.dev/guide/dep-pre-bundling).

### 11. Adapter conformance and targeted framework expansion — later

The native bridge is already the right route for JVM/.NET/Go/Elixir/Rust engines. Ship a harness starter and conformance suite covering overlays, actual dependency hashes, allowed loader roots, includes/layouts, errors, cancellation, restart and bounded output. Add explicit VS Code mappings for arbitrary adapter suffixes; custom harnesses currently have a narrower editor suffix path than CLI/MCP.

Candidate additions, subject to real project demand:

| Adapter | Initial bounded scope | What it cannot silently promise |
| --- | --- | --- |
| Astro | Static `.astro` HTML/style output using the installed compiler/runtime | Hydrated client islands, request context and server islands require separate execution paths |
| Angular | Installed Angular compiler/runtime, standalone components, explicit injector/providers | Arbitrary NgModule/application/bootstrap/server behavior |
| Go templates | Actual Go `html/template` with explicit functions/data | Template name collisions, custom application functions and backend state without setup |
| JVM templates | One selected engine, such as Thymeleaf, through its own JVM harness | All Spring services, security context or every JVM template engine |
| Razor | Distinguish MVC `.cshtml` from interactive `.razor` components | Compiling C# markup is not a complete Blazor circuit or ASP.NET request |
| HEEx | Actual Elixir/Phoenix rendering with explicit assigns/components | A static render is not a live socket session |

These are proposals, not supported-engine claims. [Astro component model](https://docs.astro.build/en/basics/astro-components/), [Astro islands](https://docs.astro.build/en/concepts/islands/), [Angular rendering](https://angular.dev/guide/components/programmatic-rendering), [Razor syntax](https://learn.microsoft.com/en-us/aspnet/core/mvc/views/razor?view=aspnetcore-10.0), [HEEx compilation](https://phoenixframework.org/blog/heex-compilation-deep-dive-liveview-1-2).

## Open-source reuse decisions

Repository/license metadata and the two ambiguous root license files were checked through GitHub on the research date. The table describes candidates, not installed dependencies or an implementation review of their internals. Review the exact package license/version before vendoring.

| Project | Verified license/status | Useful contribution | Decision |
| --- | --- | --- | --- |
| [Playwright](https://github.com/microsoft/playwright) | Apache-2.0; not archived | Existing engine: locators, emulation, screenshot controls and tracing primitives | Extend the installed dependency first; do not add a second browser engine to ordinary renders |
| [MSW](https://github.com/mswjs/msw) | MIT; not archived | Reusable project REST/GraphQL/WebSocket scenarios | Optional project-owned integration |
| [React Grab](https://github.com/aidenybai/react-grab) | MIT; not archived | UI selection and component/source context | Study APIs/source mapping; React-specific, not a universal adapter |
| [Storybook](https://github.com/storybookjs/storybook) | MIT; not archived | CSF states, tests, change/discovery workflow | Optional interoperability; avoid pulling its whole runtime into basic renders |
| [Histoire](https://github.com/histoire-dev/histoire) | MIT; not archived | Variant-grid and state-control UX | Adopt useful interaction patterns, keep shared renderer |
| [Ladle](https://github.com/tajo/ladle) | MIT; not archived | Static catalog metadata and CSF interoperability | Study schema/UX; importing the whole workbench is unnecessary |
| [Pixelmatch](https://github.com/mapbox/pixelmatch) | ISC; not archived | Tested perceptual comparison and antialiasing handling | Evaluate against current in-browser YIQ comparator; do not replace without evidence |
| [ODiff](https://github.com/dmtrKovalenko/odiff) | MIT; not archived | Native image comparison | Benchmark only if large-image diffing is a measured bottleneck; account for native packaging |
| [Vitest](https://github.com/vitest-dev/vitest) | MIT; not archived | Existing test infrastructure; optional browser assertions/replay export | Reuse current infrastructure rather than create another test runner |
| [Agentation](https://github.com/benjitaylor/agentation/blob/main/LICENSE) | PolyForm Shield 1.0.0 | Annotation/feedback UX reference | Not permissive reuse: its license contains a competition restriction; do not vendor into this product without resolving permission |
| [Preview.js](https://github.com/fwouts/previewjs/blob/main/LICENSE) | Archived; packages are MIT or AGPL-3.0 | Type/preview architecture reference | Check individual package terms; no blanket MIT or maintenance assumption |

React Grab's public reports illustrate two source-inspection edge cases: generated/virtual locations and repeated list instances sharing one JSX location. Treat issue reports as reported examples, not proof that current Arguseye has the same bug or that a closed issue remains unfixed. [Issue 417](https://github.com/aidenybai/react-grab/issues/417), [issue 469](https://github.com/aidenybai/react-grab/issues/469).

## Release gates and edge-case coverage

Keep tests at the repository's agreed HTTP, update/timing, headless-render and VS Code integration seams. Each implementation slice starts with a real failing fixture; expected output comes from that fixture. Do not add private-helper test seams without agreement.

| Category | Cases required for relevant additions |
| --- | --- |
| Inputs | Missing required value, explicit null/false/zero, unresolved expression/spread, long text, recursive or oversized data |
| Providers | Absent setup, setup throws, skipped inferred wrapper, repaired unsaved wrapper, portal outside the component |
| Assets | Missing/corrupt font, mixed scripts, image decode failure, CSS background image, unavailable remote host |
| Motion | Reduced-motion ignored, finite/infinite animation, nested reveal observer, scroll-linked animation, delayed canvas |
| Layout | Container queries, overflow, intentional clipping, sticky header, transformed ancestor, shadow DOM, iframe boundary |
| State | Repeated labels, stale ref, focus trap, loading/error/retry, handler reset, request sequence and browser-state leakage |
| Source | Aliases/barrels, dynamic import, shared CSS, template include, generated map, list instance identity, unsaved source |
| Runtime | Cold start, cache reuse/invalidation, cancellation during prepare/capture, timeout/queue wait, worker crash/restart, concurrent targets |
| Baselines | Missing/evicted capture, corrupt manifest, moved checkout, browser/OS/font mismatch, masked regions, incomplete original baseline |
| Distribution | Extracted npm and VSIX packages, real Linux/Windows/macOS execution, actual client capability handling |

Ordinary warm render must retain p95 ≤100 ms over 20 samples on a documented machine. Keep the physical edit-to-pixels 50 ms target separate. Scroll traversal, axe, font/style inspection, network delay and matrix totals need separately reported budgets; do not quietly move them into the ordinary render path or claim the same bound for a batch.

The checked benchmark file is dated October 27 and describes a scripted fixture task. It is not fresh performance evidence for this proposal or proof of a universal advantage over Playwright. Re-run representative real-project tasks when implementing: HYVE scroll sections, WiseAdmit provider/dialog contexts, CSCA font assets and a native-template project. Record failures and unresolved context alongside successful screenshots.

## Recommended first milestone

Deliver a **trustworthy render report**: real phase messages, explicit audit completeness, diagnostic recovery suggestions, bounded scroll capture and optional layout/font evidence. Then use that report in an **affected-edit check** with a bounded viewport/usage matrix.

Do not bundle every new framework, live backend reconstruction, cross-browser execution, cloud dashboards or a video editor into that milestone. Firefox/WebKit comparison is a possible later opt-in path; Arguseye's current Chromium/CDP capture and inspection assumptions require separate adapter work and baseline identities before that claim is valid.
