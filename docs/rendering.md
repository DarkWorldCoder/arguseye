# Reproducible and bounded verification (unreleased)

## Project build plugins

Native mode remains the default. It uses the fast per-file compiler, supported literal config, and explicit warnings for virtual stand-ins. For code that needs actual project plugins, use `--build-mode vite` with `mcp`, `shot`, `serve` or `audit`. The JS server/renderer factories accept `buildMode: "vite"`. VS Code exposes `arguseye.buildMode`; reload the window after changing it.

Compatibility mode requires the project's own installed Vite and plugins. It runs that real pipeline in a separate local process, with the application package as its working directory. It does not start the application's entry point, backend or configured API proxies. The isolated preview still executes trusted config, plugin and component code. Vite can write its compiler cache, and plugins can have their own effects. See [Vite's integration API](https://vite.dev/guide/api-javascript).

Both runtime and component imports use Vite's dependency graph, so React/Vue copies are not mixed with the native dependency bundle. Virtual SVGs, macros, aliases and styles are handled by installed project plugins, rather than converted to empty exports. Missing plugins fail explicitly. Framework-specific server behavior still needs the full application.

Render evidence identifies the build mode, whether plugins execute and startup cost. Native and compatibility timings are measured separately. Compatibility edits reload the preview and reset interactive state. Save build config changes to disk; unsaved component and style buffers are forwarded. Manifest, lockfile, config, environment and setup changes invalidate native caches or restart compatibility compilation; Vite's reported config dependencies are watched too. Adding native config imports that cannot be read statically remains unsupported and must stay visible in warnings.

CLI comparisons automatically select the saved baseline's build mode. The JS API rejects a restored baseline made with a different build mode. Never present a comparison between different compilers as a same-input verification.

## Browser fixtures

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

MCP execution cancellation is forwarded to the renderer. The JS API also accepts `{signal, timeoutMs}` as a second argument to `render`, `diff` and `renderUsages`; MCP exposes `timeoutMs`, and CLI `shot` exposes `--timeout-ms`. The default execution deadline is 30 seconds, excluding queue time, with a maximum of 120 seconds. Cancellation closes affected pages and abandons the capture. A subsequent render can continue. Node config execution cannot be interrupted safely inside the process; only trusted projects should run.

Each renderer retains at most four warm pages, 64 captures, 16 previous-target results, and 64 MiB of PNG buffers across captures and history. Old pages are closed and old evidence evicted. The JS `limits` option can lower these budgets, and `resources()` reports retained counts and PNG bytes. This does not bound Chromium's own heap, transient response buffers or project module caches. A single PNG over the budget is returned but not retained; the response explains how to save it externally. CLI capture directories persist across sessions and are caller-managed.

Audits process at most 500 components per request (200 by default). Pass the returned `nextCursor` back as MCP `cursor` or CLI `--cursor`, using the same root and folder. Source inventory changes expire the cursor rather than silently skipping components. Completed entries and a continuation are retained when an audit is cancelled. These remain isolated mount checks, not full application tests.
