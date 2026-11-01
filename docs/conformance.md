# Adapter and client conformance (0.0.13)

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

Undefined custom elements and pending `updateComplete` promises have a 500 ms bound and remain warnings. Classic scripts are rejected explicitly because their global/document-write semantics differ from modules. External stylesheets, relative `srcset` and inline CSS `@import` require explicit review or supported local/absolute assets. Closed shadow internals, nested asynchronous shadow work, server templates and backend-dependent states require application testing. There is no promise to render arbitrary frameworks or server applications.

Pixel comparisons use a YIQ color-distance threshold of 0.1 to suppress small rendering noise. Subtle color differences can fall below it; inspect the before/after images and source evidence. “Unchanged” is not a correctness verdict.

## Platform and client evidence

`.github/workflows/conformance.yml` builds on native Linux, Windows and macOS runners. It installs real fixture packages, checks framework/MCP contracts, packages the host's native VSIX, extracts it, verifies runtime dependencies, and executes the actual VS Code workflow. Each run uploads a machine/platform result. A configured job is not proof of a successful run: consult the resulting CI artifacts.

VSIX extraction uses a temporary directory outside the checkout. This prevents absent packaged dependencies from resolving through the repository's parent `node_modules`. The result records the isolated path; successful runs clean it up, and failed runs retain it for inspection.

On macOS, the workflow first warms browser executable loading and records three load samples five seconds apart, plus browser versions, in `benchmark-machine.json`. A 75%-of-available-cores reference annotates busy conditions; it never bypasses assertions, retries measured renders or selects a fastest run. Warm-render p95 remains <=100 ms over 20 renders; the existing live-update limit remains <100 ms against a 50 ms target. These are fixture checks on the recorded runners. Busy-run observations are not controlled benchmarks or universal performance guarantees; remeasure performance on a documented quiet machine for release benchmarking.

Live-update timing checks observe the expected visible DOM on browser animation frames. They include buffer processing, compilation, transport and browser application of the edit, without the locator API's 20/50/100 ms retry backoff. State and accessible button labels are still verified. This is frame-sampled DOM latency, not a measurement of the physical display.

Local execution on this workstation proves Linux only. Windows/macOS results must come from their native jobs. The SDK's success does not establish that a particular coding-client version displays all fields correctly. Keep actual client/version/transport checks distinct from installation-format tests and from the VS Code extension. Do not turn unexecuted platform/client checks into release claims.
