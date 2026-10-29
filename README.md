# Component Preview

See a component, change it, and inspect the consequences—without starting the app or writing stories.

Component Preview renders your actual React or Vue components with your project's packages. Coding agents receive screenshots, accessibility snapshots, source fingerprints, unresolved-input warnings, and before/after comparisons. VS Code shows a live preview of the same source and uses the same verification engine.

## Run locally

Use Node.js 22 or newer (validated on Node 24), install the target project's dependencies, and have Google Chrome available. The renderer also accepts an installed Playwright Chromium browser.

```sh
npm ci
npm run build
node /path/to/component-preview/dist/cli.mjs shot components/Card.tsx \
  --root /path/to/your-app --export Card --props '{"title":"Desk"}' --out /tmp/card.png
```

There is no application dev server to start. Component Preview itself runs a loopback-only module server and Chromium. It executes your component code and does not supply missing backends or authentication.

## Connect a coding agent

Build once, then substitute absolute paths in these examples. No API key is required.

**Codex**

```sh
codex mcp add component-preview -- node /path/to/component-preview/dist/cli.mjs mcp --root /path/to/your-app
```

**Claude Code**

```sh
claude mcp add component-preview -- node /path/to/component-preview/dist/cli.mjs mcp --root /path/to/your-app
```

**Cursor** — put this in the target project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "component-preview": {
      "command": "node",
      "args": ["/path/to/component-preview/dist/cli.mjs", "mcp", "--root", "/path/to/your-app"]
    }
  }
}
```

**VS Code agent tools** — put this in the target project's `.vscode/mcp.json`:

```json
{
  "servers": {
    "component-preview": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/component-preview/dist/cli.mjs", "mcp", "--root", "/path/to/your-app"]
    }
  }
}
```

## Agent workflow

| Tool | Purpose |
| --- | --- |
| `render_component` | Render one export with explicit, discovered, or labelled sample props. `in_context` renders inside the call site's parent elements (size, layout, background); `frame` is a stand-in parent box; `actions` (click, hover, fill, press, …) and `storage` put it into a state first; a re-render of the same target reports `changes`. |
| `render_diff` | Replay a capture against current code and return change evidence. |
| `list_usages` | Find call sites, literal props, and unresolved inputs. |
| `render_usages` | Render up to 12 isolated variants, with a continuation cursor. |
| `describe_props` | Read the React TypeScript prop schema and sample values. |


1. Call `list_usages` to find literal-prop variants. Usage IDs such as `app/page.tsx:9` can be passed back verbatim; same-line usages include a column.
2. Call `render_component` with `file`, optional `export`, `usage` or `props`, and a viewport. A successful render returns a `captureId`.
3. Edit source, then call `render_diff` with that ID. It replays the original resolved props and viewport against current code.
4. To see a component as it sits on the page, pass `usage` with `in_context: true` (its parents' width, height and background apply), or `frame: {width, height, background}` when nothing uses it yet. To reach a state first, pass `actions`, e.g. `[{"click":{"role":"button","name":"Open"}},{"fill":{"label":"Email"},"value":"a@b.c"}]`, and `storage: {local: {...}}` for logged-in or flagged states. Function props go as `{"$fn":"(x) => ..."}`.
5. Call `render_usages` to inspect other discovered variants. Follow `nextCursor` to continue; each batch contains at most 12 renders.

```json
{"file":"components/Card.tsx","export":"Card","usage":"app/page.tsx:9","viewport":"mobile","output":"both"}
```

```json
{"baselineId":"capture-id-from-render_component","output":"summary"}
```

`render_component`, `render_usages`, and `render_diff` accept `output: "image" | "summary" | "both"`; the default is `both`. Structured metadata is returned in every mode. Use `summary` when image bytes are unnecessary. `describe_props` reads React TypeScript props and supplies clearly labelled sample values when no props are provided.

Render evidence includes the target and resolved props, viewport, source revision, timing, unresolved inputs, warnings, completeness, and `errors: string[]`. Source revisions fingerprint source/styles read by the server, including editor buffers; they are not Git commit IDs or guarantees about remote assets.

Comparisons return before/after images, a highlighted pixel diff, changed-pixel percentage, dimensions, accessibility snapshot changes, and new/resolved errors. The status is `unchanged`, `changed`, or `incomplete`. Changed pixels are evidence to inspect, not a correctness verdict. The latest 64 successful captures are retained per renderer session; capture again after eviction or a restart.

Usages are isolated component renders with discovered literal props. Runtime expressions and slots/children that cannot be represented remain unresolved. Parent-page styling, backend-dependent data, and whole-application behavior require separate integration checks.

## Baselines across CLI commands

```sh
node dist/cli.mjs shot components/Card.tsx --root /path/to/app --export Card \
  --props '{"title":"Desk"}' --capture-dir /tmp/card-before --output summary --json
# Edit your component.
node dist/cli.mjs diff --root /path/to/app --baseline /tmp/card-before \
  --out /tmp/card-comparison --json
```

A baseline directory contains `capture.json` and `capture.png`. A comparison directory contains `before.png`, `after.png`, `diff.png`, and `diff.json`. `--json` emits machine-readable metadata without embedding PNG bytes. Viewports accept `mobile`, `tablet`, `desktop`, or `WIDTHxHEIGHT` up to 8192 pixels per dimension.

## VS Code panel

Build a local extension package with `npm run package -- --target linux-x64` on Linux x64, then install the resulting VSIX through **Extensions → Install from VSIX**. Build on each target platform to include its native dependencies.

Open a `.tsx`, `.jsx`, or `.vue` file and run **Component Preview: Preview Component** (`Ctrl+Alt+P`, or `Cmd+Alt+P` on macOS). The panel provides export and usage selection, editable typed React props, fixed viewport presets, **Capture Baseline**, and **Compare Changes**.

Unsaved edits update the live preview. Ordinary React refresh and Vue template/style updates preserve component state. Vue script edits reset state and report that reset. Verification renders use fresh component state. Changing selected props, usage, export, or viewport requires a new baseline.

## Compatibility and boundaries

- React JSX/TSX and browser-renderable Next.js components, global CSS, CSS modules, Tailwind v3/v4, Sass and the project's PostCSS configuration are covered by fixtures.
- Existing static root-layout wrappers and literal provider props are reused. Runtime provider inputs and wrappers that cannot be imported are reported; arbitrary provider reconstruction is not supported.
- `next/link`, `next/image`, and `next/navigation` use preview shims. This does not reproduce Next.js server components, server actions, middleware, image optimization, or server/font services. Runtime limitations remain visible in evidence.
- Vue 3 SFCs support ordinary scripts, TypeScript script setup, templates, scoped styles and CSS modules. The compiler comes from the project's `vue/compiler-sfc`, matching its runtime. Vue-only projects do not need React.
- Nuxt context, Vue SFC custom blocks, external SFC script/template/style blocks, and framework build plugins are outside the supported surface. Vue slots and runtime bindings remain unresolved in usage discovery.
- Screenshots freeze motion and wait up to 300 ms for image/font settling. Failed or unsettled assets mark evidence incomplete. Network-dependent content, continuously changing content and app side effects are not made deterministic automatically.

## Validation and performance

```sh
npm test
npm run typecheck
npm run test:vscode
npm run benchmark
npm run package -- --target linux-x64
```

Install fixture dependencies with `npm ci --prefix test/fixtures/<app>` before running tests. Browser/server tests need local socket and Chromium permissions. The warm-render gate checks p95 ≤100 ms over 20 renders. Live-edit tests enforce <100 ms and record progress toward the 50 ms product target; these are separate measurements.

The reproducible benchmark uses real MCP clients, a real Vite app, and the same fixture edit. Results and machine details are saved in `benchmarks/latest.json`. It measures scripted calls, response bytes, elapsed time, and an explicitly approximate text-token count. It does not measure LLM reasoning, model image tokens, or establish a general competitive ranking.

Contributors and coding agents follow `AGENTS.md`, including red → green slices and the approved test seams. MIT licensed.
