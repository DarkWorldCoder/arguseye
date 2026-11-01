# Reproducible and bounded verification (0.0.14)

## Project build plugins

Native mode remains the default. It uses the fast per-file compiler, supported literal config, and explicit warnings for virtual stand-ins. For code that needs actual project plugins, use `--build-mode vite` with `mcp`, `shot`, `serve` or `audit`. The JS server/renderer factories accept `buildMode: "vite"`. VS Code exposes `arguseye.buildMode`; reload the window after changing it.

Compatibility mode requires the project's own installed Vite and plugins. It runs that real pipeline in a separate local process, with the application package as its working directory. It does not start the application's entry point, backend or configured API proxies. The isolated preview still executes trusted config, plugin and component code. Vite can write its compiler cache, and plugins can have their own effects. See [Vite's integration API](https://vite.dev/guide/api-javascript).

Both runtime and component imports use Vite's dependency graph, so React/Vue copies are not mixed with the native dependency bundle. Virtual SVGs, macros, aliases and styles are handled by installed project plugins, rather than converted to empty exports. Missing plugins fail explicitly. Framework-specific server behavior still needs the full application.

Render evidence identifies the build mode, whether plugins execute and startup cost. Native and compatibility timings are measured separately. Compatibility edits reload the preview and reset interactive state. Save build config changes to disk; unsaved component and style buffers are forwarded. Manifest, lockfile, config, environment and setup changes invalidate native caches or restart compatibility compilation; Vite's reported config dependencies are watched too. Adding native config imports that cannot be read statically remains unsupported and must stay visible in warnings.

CLI comparisons automatically select the saved baseline's build mode. The JS API rejects a restored baseline made with a different build mode. Never present a comparison between different compilers as a same-input verification.

## Browser fixtures

Render timings split capture into layout, screenshot and accessibility work. Screenshot and accessibility capture run concurrently, so their durations are not additive; `capture` remains their total wall time including layout. Native module responses expose compilation cost through `Server-Timing`. Native verification uncaps compositor cadence and losslessly crops current in-viewport captures. Linux/Windows use native viewport clips; macOS uses the viewport surface and an isolated browser realm to crop, avoiding clipped-surface stalls and application canvas overrides. Fractional CSS bounds use their enclosing device-pixel rectangle, preserving partial edge pixels without resampling. Offscreen boxes and viewports over four megapixels retain Chromium's direct clipped capture. Finite native Web Animations finish before capture; unbounded animations pause at their first frame and return an explicit warning. Canvas settling requires at least six stable frames and 100 ms of stable dimensions, with a one-second cap, independently of frame rate. These measurements and bounds do not guarantee that every project or machine meets the fixture speed budget.

Ordinary verification keeps the browser and modules warm and remounts the component. Module globals can persist. Use explicit fixtures when module-initialization time, randomness, browser locale or network data must repeat.

```json
{
  "now": "2026-01-01T00:00:00.000Z",
  "randomSeed": 42,
  "locale": "en-GB",
  "timezoneId": "UTC",
  "network": {
    "policy": "block-unmatched",
    "responses": [
      {"url": "/api/user", "contentType": "application/json", "body": "{\"name\":\"Example\"}"}
    ]
  }
}
```

Pass this object as `fixtures` to `render_component`, or save it and run `shot FILE --fixtures inputs.json --capture-dir baseline`. `render_diff` and CLI `diff` replay the saved fixtures and storage in a fresh context before project modules execute. Evidence includes a SHA-256 input digest and matched/blocked requests. Mock data is caller-authored evidence, not a real backend. Stored baselines contain fixture bodies and storage: avoid credentials in sharable captures.

The fixed clock affects `Date` only. Timers, `performance.now()`, crypto randomness, workers, GPU behavior and external services are not made deterministic. Network fixtures match exact HTTP URLs, or same-origin paths including queries and methods. Up to 50 responses and 1 MiB of fixture JSON are allowed. `block-unmatched` permits engine transport and same-origin script/style/font/image loading, blocks other unmatched application requests and WebSockets, and reports blocks as incomplete evidence. This is a browser test policy, not a security sandbox for trusted project configs or compilers.

Engine error timestamps use the actual request time independently of application clock fixtures, so repaired errors are not replayed into later failures. Animation-frame callbacks are tracked through execution and cancellation. Work still pending after the bounded settle step remains an explicit stability warning, including shadow-DOM and canvas loops that document mutations cannot observe. Application/dependency timeouts and intervals are counted in `scheduledTimers`; a count alone can include housekeeping and is not a failure. If a comparison changes pixels or accessibility text with unchanged source/inputs while timers remain scheduled, it reports incomplete stability evidence. Engine deadlines, Vite transport timers and cancelled timers do not count. Timers are not fast-forwarded or awaited indefinitely. This is separate from an asset-loading failure; a captured frame does not establish that a GPU scene has settled.

MCP execution cancellation is forwarded to the renderer. The JS API also accepts `{signal, timeoutMs}` as a second argument to `render`, `diff` and `renderUsages`; MCP exposes `timeoutMs`, and CLI `shot` exposes `--timeout-ms`. The default execution deadline is 30 seconds, excluding queue time, with a maximum of 120 seconds. Cancellation closes affected pages and abandons the capture. A subsequent render can continue. Node config execution cannot be interrupted safely inside the process; only trusted projects should run.

Each renderer retains at most four warm pages, 64 captures, 16 previous-target results, and 64 MiB of PNG buffers across captures and history. Old pages are closed and old evidence evicted. The JS `limits` option can lower these budgets, and `resources()` reports retained counts and PNG bytes. This does not bound Chromium's own heap, transient response buffers or project module caches. A single PNG over the budget is returned but not retained; the response explains how to save it externally. CLI capture directories persist across sessions and are caller-managed.

Audits process at most 500 components per request (200 by default). Pass the returned `nextCursor` back as MCP `cursor` or CLI `--cursor`, using the same root and folder. Source inventory changes expire the cursor rather than silently skipping components. Completed entries and a continuation are retained when an audit is cancelled. These remain isolated mount checks, not full application tests.

## Optional accessibility and source evidence

Use MCP `inspection: {accessibility: true, sources: true}` or CLI `shot --accessibility --sources`. Ordinary renders skip these heavier checks. Evidence reports their cost separately in `timings.inspection` and reports the actual browser locale/timezone and clock/randomness policy.

[axe-core](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md) runs WCAG 2 A/AA and 2.1 A/AA checks within the captured component (or body for portals). Results contain violations, checks needing review (`incomplete`), applicable pass counts, and bounded selectors/HTML snippets. Violations do not make a screenshot incorrect or prove an app is inaccessible; no violations do not establish conformance. Full-page structure, keyboard journeys, screen-reader testing and human review still matter.

Error evidence includes original TypeScript/JSX locations where the native transform preserves a trustworthy source map. Vite mode uses its actual transform maps. Native SFC and Solid compiler chains, rewritten barrels and package chunks can lack composed maps; those references remain explicitly unmapped. Element evidence distinguishes exact mapped positions from an owning component file and from elements with no trustworthy reference. It never invents a source line from a component name.

Vue prop inspection reads imported type declarations, literal macro defaults and ordinary runtime prop declarations. Static `defineEmits` and `defineSlots` names are returned alongside limitations. React inspection retains TypeScript parameter props and literal defaults. Computed declarations and complex type-level behavior require source review. Vue compilation uses the same approved roots and unsaved type buffers as metadata inspection.
