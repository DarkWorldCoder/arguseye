# Arguseye: the next verification features

Research date: 6 November 2026. Source inspected: `78102c4bd8bd0d211bd54f7966dd83da875745a6`, version 0.0.21. This document proposes work; it does not describe newly implemented support. No runtime dependency was installed, third-party implementation copied, or new benchmark executed during this research.

## Recommendation

Build one coherent workflow: **choose the states worth checking, make the edit, and verify explicit expectations across those states.** Agents receive a compact coverage report; developers review the same evidence in VS Code.

The previous roadmaps already proposed affected-target discovery, matrices, assertions and MSW integration. Keep those priorities, but add genuinely new work around capture readiness, persistent regression recipes, CSS explanations, portable diagnostics, and client compatibility. Do not count existing screenshots, actions, fonts, scroll capture or basic network fixtures as new features.

## What the source establishes

- `src/agent/createRenderer.ts` already runs bounded actions, captures portals, saves baselines and serializes renderer jobs. Its action helper at lines 761–801 scopes targets to `#root` and calls `.first()` for every locator. A duplicate label can therefore select one match implicitly, and actions cannot directly address a body-level portal through that root. These are source-observed limitations, not newly reproduced runtime failures in this research.
- `src/agent/renderFixtures.ts` supports fixed HTTP method/URL responses, clock/random inputs and unmatched-request policy. It rejects duplicate method/URL fixtures; response sequences and GraphQL operation matching are not that contract.
- `src/agent/inspectElementStyles.ts` reports bounds, computed styles and actual fonts. It does not provide a general matched-CSS-rule explanation or a VS Code element picker.
- `src/agent/mcpServer.ts` exposes structured tools and progress. It does not register MCP image/report resources. SDK transport tests do not establish that every coding client presents those results correctly.
- `src/server/moduleGraph.ts` retains project import information and `src/usages/createUsageIndex.ts` provides an incremental usage index. Neither establishes a complete project-wide impact graph: runtime-selected imports, template includes, CSS/assets and unvisited modules need explicit treatment.
- Existing limits include four retained pages, 64 captures and a 64 MiB PNG budget. New batches must respect bytes as well as item counts.

## First delivery: reliable state verification

### 1. Explicit capture readiness — new

Let a caller say what must be ready before the screenshot: an exact locator becomes visible, a loading indicator disappears, or a project-owned setup signal resolves. Record the condition, observed result, elapsed time and timeout. Keep the ordinary fast path unchanged when no condition is requested.

Do not use global network-idle as proof of readiness: dashboards, polling and streaming interfaces can remain active. A timeout returns the available image and incomplete evidence. Actionability is also distinct from application readiness: [Playwright checks whether an action can execute](https://playwright.dev/docs/actionability), while [assertions retry expected states](https://playwright.dev/docs/test-assertions).

Acceptance: delayed mount, perpetual loader, hidden duplicate spinner, cancelled condition, error boundary, and readiness that succeeds while unrelated polling continues. Test through the public headless render seam with installed fixtures.

### 2. Strict interactions and explicit expectations — extend existing actions

Add an explicit target scope for the component and its captured portals. Reject ambiguous matches and return candidate descriptions instead of choosing the first. Do not include unrelated page UI merely because it is in `body`. Add typed expectations for visible text, count, checked/expanded state and focus. Separate `passed`, `failed` and `not-run` expectations from render errors and evidence completeness.

Keep locator-based requests as the initial API. Revision-bound element references can follow after their expiry semantics are tested. Avoid adding an arbitrary browser-JavaScript execution interface. [Playwright locator strictness](https://playwright.dev/docs/locators#strictness) is the reference behavior, not proof that Arguseye currently implements it.

Acceptance: two Save buttons, a body-level dialog, keyboard focus return, DOM replacement during a wait, detached targets, cancelled actions and timeout cleanup. A screenshot difference alone never passes or fails an expectation that the caller did not specify.

### 3. Save a verified fix as a regression recipe — new

After reviewing a successful interaction and comparison, save a versioned local recipe containing the target/export, usage or explicit input provenance, viewport/theme, fixtures, readiness and expectations. A later agent or CI run replays it through the same renderer. VS Code gets **Save regression check** and **Run saved checks**.

Begin with JSON recipes and one documented replay command. Code export is a later convenience: it must call a supported runner API and pass against a fresh installed package; do not emit an end-to-end test that silently assumes an application server. [Playwright code generation](https://playwright.dev/docs/codegen) is a useful precedent for turning interaction into a maintained check.

Acceptance: a fresh process replays the recipe; renamed exports and missing data fail actionably; unsupported recipe versions are rejected; storage/body secrets are not copied into tracked files without explicit selection. Saving a recipe does not silently approve or overwrite its baseline.

## Second delivery: coverage of an edit

### 4. Bounded viewport/theme/state comparison — previous proposal, still the flagship

Expose one shared verification operation to MCP, CLI and VS Code. Start with explicitly selected cells, not a Cartesian explosion: for example, mobile/desktop × light/dark, with real usage props. Additional long-text, empty or error inputs must be caller-authored or clearly identified as samples.

Proposed initial defaults: at most 12 cells per execution page, a 30-second execution budget, cancellation, and the existing retained-image byte cap. These are design defaults to validate, not measured throughput promises. Use one outer renderer queue job with an internal batch executor; calling a queued public render from inside the same queue would risk deadlock. Report queue wait separately from execution time.

Each cell records input digest, source revision, baseline identity, outcome and warnings. Compare like-for-like cells; missing baseline means `not-compared`, never `unchanged`. If source changes mid-run, mark the run inconsistent/incomplete and offer a rerun rather than combine revisions into a clean report. Retain completed cells after cancellation; pending cells stay untested. Do not increase the 64-capture or byte budgets invisibly to keep a matrix alive.

Return counts of requested, executed, compared, incomplete, failed and skipped cells, plus changed/error images on demand. [Histoire's visual profiles, saved matrix cases and offline review](https://histoire.dev/guide/visual-testing) are useful precedents; its story-based model is not a requirement for Arguseye.

Acceptance: theme/storage isolation, unresolved props, missing baseline, environment mismatch, assertion-only change with identical pixels, budget exhaustion, concurrent requests and source edits during a run. Ordinary warm-render p95 remains ≤100 ms over 20 renders; batch/inspection time is measured separately.

### 5. Affected component and usage plan — previous proposal

Accept explicit changed paths first; add a local Git-ref comparison afterward, resolving refs to immutable SHAs without checking out branches. Return candidate targets with dependency paths explaining their inclusion. Preview a paginated dry-run plan before executing project code. Preserve unsaved buffer identity.

Start with indexed imports/re-exports, known styles and observed template dependencies. Mark dynamic imports, runtime include names, unvisited files and unsupported relationships as unknown coverage. An empty candidate list is not proof that nothing is affected. [Storybook's changed-story and reverse-dependency tools](https://storybook.js.org/docs/ai/mcp/overview) show the value of explaining the edit's reach.

Acceptance: a shared CSS change, barrel rename, deleted target, cyclic imports, workspace package change, template include and an unsaved provider edit. Validate precision and omissions against hand-listed fixture expectations. Do not use the implementation's own graph as its expected answer.

## Additional features beyond the previous priority list

| Feature | Concrete developer/agent value | First bounded slice |
| --- | --- | --- |
| **Explain this appearance** | Identify the rule, variable or inherited font behind an unexpected result | Optional matched CSS rules and file locations for one selected element; report generated/unmapped rules honestly |
| **Pick an element in VS Code** | Replace vague descriptions such as “that button” with source and evidence | Select element → source line, bounds, actual fonts and copied structured context; inspect only the preview document |
| **Portable bug-report bundle** | Reproduce a preview failure without exchanging a whole private repository | Local manifest, package/runtime versions, diagnostics and an explicitly chosen minimal fixture; review contents before any upload |
| **Explain a failed import or stale preview** | Show whether a real package, alias, shim, plugin or cache entry was used | Opt-in bounded resolution/transform trace for the failing dependency chain; no trace cost on ordinary renders |
| **Agent session resume** | Continue a baseline/edit comparison after an MCP restart | Persist explicit recipe and capture manifests; validate source, case and runtime identity before reuse; stale evidence remains reviewable but incomplete |
| **Workspace/package selector** | Make monorepo previews reproducible when several packages contain similarly named exports | Explicit selected package/root plus its resolver/toolchain identity, shown in VS Code and results; no silent search across arbitrary filesystem roots |
| **Client capability diagnostics** | Explain why an agent receives text but no image or cannot cancel work | Test actual client/version/transport combinations and expose negotiated capabilities through existing project/session inspection |
| **Adapter authoring kit** | Allow a team to add one unsupported native template engine correctly | Harness starter, installed fixture, overlay/include/cancel/restart conformance and explicit VS Code suffix mapping |

For CSS explanations, Chromium exposes [matched styles](https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-getMatchedStylesForNode); protocol support and CSS source maps must be checked at runtime. A matched rule alone does not establish why it wins every cascade case. For compilation explanations, [vite-plugin-inspect](https://github.com/antfu-collective/vite-plugin-inspect) is a reference for actual Vite plugin transforms, not an excuse to execute Vite plugins in native mode.

A diagnostic bundle defaults to omitting request bodies, storage values, credentials and unrelated source. It can still contain sensitive screenshot text or source paths; local content review remains necessary. Do not claim that heuristic redaction guarantees anonymity.

## Third delivery: realistic data and portable review

### Project-owned scenarios

Extend fixed fixtures only where a real case needs sequences, delay, failures or body/GraphQL-operation matching. Prefer evaluating the official [MSW Playwright adapter](https://github.com/mswjs/playwright) for importing project-owned handlers. Its documented route-based bridge avoids requiring a browser worker, but inherits routing limitations; compatibility with Arguseye's `playwright-core`, page lifecycle and request policy is untested.

Prototype in an installed fixture before selecting it. Scope interception to one fresh case, allow only one owner per request, reset one-shot handlers between cells, and report unmatched requests. Start with HTTP/GraphQL; do not advertise SSE/WebSocket/service-worker equivalence without dedicated evidence. The adapter must be optional and use explicit trusted project setup.

### Local report and compact agent artifacts

Build a self-contained HTML review with before/after/diff, expectations, source/input identity, warnings and cell coverage. Keep report generation separate from render success. Retain raw images; masks or tolerances, if later added, must be explicit and shown in the report.

Add real MCP resource reading for retained images/reports with session scope, expiry and byte limits. Preserve inline-image fallback; a URI alone is not a working integration. [MCP resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) are client-mediated, so actual client testing is required. Optional failure traces can reuse [Playwright tracing](https://playwright.dev/docs/api/class-tracing), but screenshots, DOM and network evidence require opt-in local retention and bounded size.

Keep CI outcome dimensions separate: assertions failed, execution failed, evidence incomplete and visual change needs review. Ordinary CI never updates a baseline automatically. [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) and [reg-suit](https://github.com/reg-viz/reg-suit) provide relevant comparison/report precedents.

## Open-source reuse decisions

Metadata and default-branch licenses were inspected through GitHub on the research date. File/package licenses must be checked again before copying implementation; a repository-level identifier is not a dependency audit.

| Project | Observed licensing/status | Decision |
| --- | --- | --- |
| [Playwright](https://github.com/microsoft/playwright) | Apache-2.0 | Reuse the existing browser dependency and public locator/tracing APIs where applicable |
| [Storybook](https://github.com/storybookjs/storybook) | MIT | Study impact discovery and interaction contracts; avoid adding its full runtime |
| [Histoire](https://github.com/histoire-dev/histoire) | MIT | Study matrix/profile/review UX; implement against our shared renderer |
| [MSW](https://github.com/mswjs/msw) and [its Playwright adapter](https://github.com/mswjs/playwright) | MIT | Optional project-owned handler experiment, not an installed feature |
| [Vitest](https://github.com/vitest-dev/vitest) | MIT | Existing test infrastructure; study browser component test lifecycle and mock reset |
| [vite-plugin-inspect](https://github.com/antfu-collective/vite-plugin-inspect) | MIT | Transform diagnostics reference for explicit compatibility mode |
| [reg-suit](https://github.com/reg-viz/reg-suit) | MIT | Local visual-report/reference patterns; cloud publishing not required |
| [Agentation](https://github.com/benjitaylor/agentation) | [PolyForm Shield](https://github.com/benjitaylor/agentation/blob/main/LICENSE), including competing-use restrictions | Product reference only; do not copy or bundle its implementation for this plan |
| [Preview.js](https://github.com/fwouts/previewjs) | Archived; [package-specific MIT/AGPL-3.0](https://github.com/fwouts/previewjs/blob/main/LICENSE) | Historical reference, not a new runtime dependency |

## Delivery and release gates

1. **First slice:** readiness + strict targeting, then explicit expectations. Write a failing public headless-render regression before implementation, including duplicate names and a portal action. Keep backward compatibility deliberate: document changed ambiguity behavior rather than quietly choosing a different element.
2. **Next slices:** persisted recipes, then bounded selected-cell verification. Add the VS Code controls only after the shared engine contract works through CLI/MCP. Existing ordinary preview state stays separate from fresh verification state.
3. **Then:** affected-target planning, selected-element explanation, optional project-owned scenarios, and portable reports/resources. Introduce neither cloud review nor another framework merely to lengthen a compatibility list.
4. Follow red → green at existing HTTP/headless/update seams, one passing slice per commit. Keep VS Code integration to one or two meaningful end-to-end tests. Agree any genuinely new test seam with the maker before adding it.
5. Run all tests, type checking, fresh npm render/diff/recipe checks, and exact extracted VSIX integration. Keep native Linux x64, Windows x64 and macOS ARM64 release gates. Measure cold setup, warm render, interaction/readiness, matrix execution, memory and response bytes separately. Preserve the 100 ms warm gate and separate physical 50 ms edit-to-pixels target.
6. Test tiny installed fixtures plus selected real React/Next, Vue, HTML/Web Component and native-template projects. Record expected cases and unsupported context. The existing Geeker and HYVE projects are candidates for local checks, not proof of universal rendering or permission to publish their code/screenshots.
7. Update README, website, agent skill and Marketplace copy only for implemented and verified behavior. Verify public registries separately. Do not assign a release number or claim this plan shipped before those gates pass.

## Release communication requirement

Maker instruction: each new feature/release should get platform-specific communication. Use [the companion checklist](release-content-workflow-2026-11-06.md). Create the release pack from verified changes, with publication tracked separately per destination. Preserve the existing daily LinkedIn limit and queue. No social post or article was published by this research turn.
