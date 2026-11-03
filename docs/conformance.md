# Adapter and client conformance (0.0.16)

Support means the bounded behaviors below have installed fixtures. It does not mean every package, backend, framework plugin or coding client is certified.

| Capability | Installed fixtures / checks | Boundary |
| --- | --- | --- |
| React and browser Next.js | `react-app`, `next-app`, `edge-app`, `libs-app` | Browser stand-ins do not execute Next server loaders, middleware or server actions. |
| React Router / Remix | `router-app` | Memory router and browser components; no application backend. |
| Vue 3 | `vue-app`, `vue-edge-app`, `vue-auto-app` | Ordinary/script-setup SFCs, scoped/module styles, imported prop types and explicit setup. Computed metadata can remain unresolved. |
| Nuxt browser components | `nuxt-app` | Browser stand-ins; no Nuxt SSR, loaders, middleware or complete generated runtime. |
| Svelte / SvelteKit | `svelte-app`, `sveltekit-app` | Browser compilation and explicit mount context; edits remount. Kit server behavior remains outside scope. |
| Preact / Solid | `preact-app`, `solid-app` | Their own runtime/compiler and actual installed packages; no substitution with React. |
| Actual Vite plugins | `vite-plugin-app`; Geeker SVG verification | Explicit compatibility mode, isolated process. Requires installed project plugins; costs measured separately. |
| HTML and Web Components | `web-components-app` with installed Lit | Separate native adapter; actual module scripts, shadow DOM, property inputs, CSS, actions and comparisons. No React requirement. |
| Accessibility / sources | `inspection.test.ts` | Optional component-scope axe checks and mapped locations; no conformance/correctness verdict. |
| MCP | Real SDK transports and private archive checks | Versioned schemas and structured errors are checked. Actual Codex/Claude/Cursor UI execution is a separate client check. |
| VS Code | Extracted VSIX workflow | Mounted preview, controls, unsaved edit and baseline comparison run against packaged code. |

## HTML contract

Render an existing `.html` file. Module scripts, including inline modules, use project import resolution and packages. Linked local stylesheets use the shared CSS pipeline. The body markup and inline styles render directly, and ordinary Web Components (including Lit) keep their own runtime and shadow DOM.

With one custom element, props are assigned as actual element properties. For multiple elements, pass its tag as `export`, such as `"demo-card"`. Literal markup attributes remain real inputs. Fresh renders create fresh element instances. Script/HTML edits reload the realm to avoid re-registering an existing custom-element definition; live HTML edits reset state. Verification resets pointer, focus and scroll inherited from previous actions. HTML uses native mode; compatibility mode reports a recovery error for HTML targets.

Undefined custom elements and pending `updateComplete` promises have a 500 ms bound and remain warnings. Classic scripts run in document order before module scripts, as a parser would, on a fresh page per render because they write real globals. They run after the document has parsed, as an `async` embed script does. `document.write` is emulated by inserting its markup where the parser would; scripts inside written markup do not run. A `.js`/`.cjs` file with no `import`/`export` renders as a classic-script widget the same way: props become `window.__ARGUSEYE_WIDGET_CONFIG__` and `data-*` props attributes of its `<script>`. External stylesheets, relative `srcset` and inline CSS `@import` require explicit review or supported local/absolute assets. Closed shadow internals, nested asynchronous shadow work, server templates and backend-dependent states require application testing. There is no promise to render arbitrary frameworks or server applications.

Pixel comparisons use a YIQ color-distance threshold of 0.1 to suppress small rendering noise. Subtle color differences can fall below it; inspect the before/after images and source evidence. “Unchanged” is not a correctness verdict.

## Platform and client evidence

`.github/workflows/conformance.yml` builds on native Linux and Windows runners and a pinned macOS 15 ARM64 runner. The release workflow uses the same macOS baseline; automatic `macos-latest` image migrations cannot silently change it. macOS 26 packaged-extension checks passed on the earlier runner, but no accepted quiet-machine performance baseline was established there. It installs real fixture packages, checks framework/MCP contracts, packages the host's native VSIX, extracts it, verifies runtime dependencies, and executes the actual VS Code workflow. Each run uploads a machine/platform result. A configured job is not proof of a successful run: consult the resulting CI artifacts.

VSIX extraction uses a temporary directory outside the checkout. This prevents absent packaged dependencies from resolving through the repository's parent `node_modules`. The result records the isolated path; successful runs clean it up, and failed runs retain it for inspection.

On macOS, the workflow first warms browser executable loading and records browser versions and five-second readiness intervals in `benchmark-machine.json`. Readiness requires three consecutive intervals with at least 75% aggregate CPU idle time and at most 25 ms timer scheduling delay. CPU idle comes from differences in the operating system's CPU counters; missing or invalid counters cannot establish readiness. One-minute load averages remain context, not a CPU-utilization percentage or a pass/fail condition. Waiting is bounded to five minutes: if readiness is not established, preflight fails and performance tests do not run. Measured renders are never retried and no fastest run is selected. Warm-render p95 remains <=100 ms over 20 renders; the live-update limit remains <100 ms against a 50 ms target. These are fixture checks on the recorded runners, not universal performance guarantees. Physical-display performance remains a separate benchmark.

Live-update timing checks measure the notification of the expected visible DOM mutation, using the renderer's uncapped headless compositor setting. The observer checks text and computed visibility, so the measurement includes buffer processing, compilation, transport and browser application of the edit. The <100 ms DOM-update bound is separate from the 50 ms edit-to-pixels product target. Frame-observation latency is logged separately and the update must still become visible within two seconds. State and accessible button labels are verified. Locator retry backoff and headless frame scheduling are not counted as DOM-update latency; no physical-display or VS Code refresh-rate benchmark is claimed.

Local execution on this workstation proves Linux only. Windows/macOS results must come from their native jobs. The SDK's success does not establish that a particular coding-client version displays all fields correctly. Keep actual client/version/transport checks distinct from installation-format tests and from the VS Code extension. Do not turn unexecuted platform/client checks into release claims.

## Native template adapters

[Native template contracts](templates.md) define the Node/Python/PHP/Ruby engine matrix and custom JSON-lines bridge. Installed fixtures exercise source escaping, includes, dependency edits, setup code overlays, error recovery and baseline context replay. A licensed DejaVu Sans Mono fixture checks real font loading; missing and corrupt font faces keep captures incomplete. Workers are packaged with the shared renderer. [Run 41601692386](https://github.com/DarkWorldCoder/arguseye/actions/runs/41601692386) passed native framework/MCP checks and extracted VSIX integration on Linux x64, Windows x64 and macOS 15 ARM64 at source `d048e1a`. Exact release packages are checked again by the release workflow; local Linux evidence alone does not establish another platform’s behavior. Handlebars has its own p95 warm-render check over 20 renders at the unchanged 100 ms limit. Interpreters, explicit setup and compiled server harnesses have separate cold-start costs. Unknown runtimes require an actual adapter and installed conformance evidence. No universal server-template support is claimed.
