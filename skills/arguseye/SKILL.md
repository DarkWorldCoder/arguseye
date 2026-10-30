---
name: arguseye
description: Preview React, browser-renderable Next.js and Vue 3 components from project source without starting the app. Use to inspect UI edits, literal-prop usage variants, component states and visual differences through Arguseye MCP tools or its CLI. Reports missing context; use application-level browser tests for complete journeys.
---

# Arguseye

Render component source in Chromium with the project's packages, styles, assets and statically reconstructable layouts. Inspect a cropped PNG, accessibility snapshot, resolved inputs, warnings and errors. The application server and authored stories are unnecessary; project dependencies and a compatible Chromium browser are still required. Startup and warm render times vary with the project; read the returned timings.

## When to use it
- After editing a component: render it again; the result says what changed (`changes`) since the last render of the same target.
- For a shared component: inspect relevant call-site variants with `render_usages`, following pagination when broader coverage is needed. Use `usage` plus `in_context: true` to reconstruct its parent elements.
- When a component needs a state: pass `actions` (click, hover, fill, press, scroll, wait) and `storage` (localStorage/sessionStorage flags). Storage seeds do not reconstruct a backend or an authenticated application journey.
- When a component has no usage yet: `describe_props` gives the schema and sample props; `frame` gives it a parent box of a chosen size and background.

## Tools (MCP server `arguseye`)
| Tool | Use |
|---|---|
| `render_component {file, export?, usage?, props?, viewport?, theme?, in_context?, frame?, actions?, storage?, output?}` | Render with a discovered usage or explicit props. `viewport`: `mobile`, `tablet`, `desktop` or `WxH`. `theme`: `light` or `dark` forces the colour scheme (the `dark` class on `<html>`, `color-scheme`, `prefers-color-scheme`); check both when the app has a dark mode. Without supplied inputs, required props may be generated from TypeScript samples. |
| `list_usages {file, export?}` | Every call site with literal props, unresolved runtime props, and the JSX ancestors (`context`). |
| `render_usages {file, export?, viewport?, theme?, cursor?, limit?, output?}` | A page of isolated literal-prop variants, not full-page integration tests. `limit` is 1–12; pass the returned `nextCursor` as `cursor` until it is null. |
| `describe_props {file, export?}` | Props from the TypeScript type, with sample values. |
| `render_diff {baselineId, output?}` | Compare current code with a successful render's `captureId`, reusing resolved props and viewport. Returns before/after/highlighted images and change evidence. |

Function props are passed as `{ "$fn": "(x) => ..." }`. Paths are relative to the project root the server was started with.

For render tools, `output` is `"image"`, `"summary"` or `"both"` (default). Use summary for a compact text response, image for visual inspection, or both when needed. Structured evidence remains available separately from image bytes.

## Reading a result
- `errors[]` are real: a resolve error names the import and the importer; a render error carries the component stack. Fix them before trusting the pixels.
- Read `warnings[]`, `unresolved[]`, `propsSource` and `complete` before trusting context. Generated samples are not real application data; provider gaps, runtime values or unsettled assets can make a successful render incomplete.
- `changes` and explicit diffs report `unchanged`, `changed` or `incomplete`, with pixel, accessibility and error evidence. None of these establishes that the intended behavior is correct.
- `timings` (prepare, show, settle, capture) tell you whether a slow render is loading, rendering or waiting for images.
- `layoutsApplied` and `contextApplied` list the layouts/templates and the call-site ancestors the component was wrapped in.
- `sourceRevision` fingerprints files read by this preview session, not the whole application's external state or a Git commit.

## Baselines and comparison limits

Successful renders return an immutable `captureId`. The renderer retains the latest 64 captures per session; restarting the server or eviction makes an old ID unavailable. Capture again when the error names an unknown or expired baseline.

An explicit `render_diff` replays the baseline's file, export, resolved props, viewport, theme, `frame`, `in_context` parent box, `actions` and `storage` (since 0.0.8), so a stateful or contextual baseline compares like for like. It does not restore the live editor's interaction state. Next.js server execution, Nuxt context and arbitrary runtime providers require the application environment.

## Without MCP (CLI)
```bash
npx @ayushniroula/arguseye shot src/components/Card.tsx --export Card --usage app/page.tsx:12 --in-context --out card.png
npx @ayushniroula/arguseye usages src/components/Card.tsx --export Card
npx @ayushniroula/arguseye serve src/components/Card.tsx --export Card --port 4321
```

Use `shot --json` for structured metadata and `--output summary` to omit the ordinary PNG output. CLI baselines survive separate commands when explicitly saved in a chosen directory:

```bash
npx @ayushniroula/arguseye shot src/components/Card.tsx --export Card --capture-dir /tmp/arguseye-before --json --output summary
# Edit the component in the same project, then compare:
npx @ayushniroula/arguseye diff --baseline /tmp/arguseye-before --out /tmp/arguseye-diff --json
```

The baseline directory contains `capture.json` and `capture.png`; comparison writes `before.png`, `after.png`, `diff.png` and `diff.json`. The same replay limits apply to saved CLI baselines.

## Workflow
1. `list_usages` for the component you changed.
2. `render_component` with the first usage and `in_context: true`; read `errors`, then the snapshot, then the PNG.
3. Edit; render the same target again and read `changes`.
4. Inspect relevant `render_usages` pages when the component is shared; report incomplete context and the variants actually checked.
