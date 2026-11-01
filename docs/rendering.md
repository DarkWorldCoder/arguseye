# Reproducible and bounded verification (unreleased)

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
