---
name: component-preview
description: See what a React, Next.js or Vue component or page looks like, exactly as in the app, without a dev server. Use after writing or editing UI, to check a layout, a style, a state (open menu, filled form, hovered), a usage in its real parent, or what an edit changed. Works through the component-preview MCP tools, or the CLI when MCP is unavailable.
---

# Component Preview

Eyes for coding agents: render any component from source with the project's own packages, global CSS, Tailwind, theme providers and nested layouts, in Chromium, and get back a cropped PNG, the accessibility tree, layout timings and errors with file paths. Warm renders take tens of milliseconds; nothing needs to be running.

## When to use it
- After editing a component: render it again; the result says what changed (`changes`) since the last render of the same target.
- Before claiming a UI task is done: render the component at every call site (`render_usages`) and in its parent box (`in_context: true`).
- When a component needs a state: pass `actions` (click, hover, fill, press, scroll, wait) and `storage` (localStorage/sessionStorage for logged-in or flagged states).
- When a component has no usage yet: `describe_props` gives the schema and sample props; `frame` gives it a parent box of a chosen size and background.

## Tools (MCP server `component-preview`)
| Tool | Use |
|---|---|
| `render_component {file, export?, usage?, props?, viewport?, in_context?, frame?, actions?, storage?}` | The render. Prefer `usage` ids from `list_usages` so the props are real. `viewport`: `mobile`, `tablet`, `desktop` or `WxH`. |
| `list_usages {file, export?}` | Every call site with literal props, unresolved runtime props, and the JSX ancestors (`context`). |
| `render_usages {file, export?, viewport?}` | The component at each call site, paginated: the blast radius of a change in one call. |
| `describe_props {file, export?}` | Props from the TypeScript type, with sample values. |
| `render_diff {baselineId}` | Replay a `captureId` against current code for an explicit before/after. |

Function props are passed as `{ "$fn": "(x) => ..." }`. Paths are relative to the project root the server was started with.

## Reading a result
- `errors[]` are real: a resolve error names the import and the importer; a render error carries the component stack. Fix them before trusting the pixels.
- `warnings[]` name what could not be reconstructed (a runtime provider prop, a missing env var); the PNG is still faithful for everything else.
- `timings` (prepare, show, settle, capture) tell you whether a slow render is loading, rendering or waiting for images.
- `layoutsApplied` and `contextApplied` list the layouts/templates and the call-site ancestors the component was wrapped in.

## Without MCP (CLI)
```bash
npx component-preview shot src/components/Card.tsx --export Card --usage app/page.tsx:12 --in-context --out card.png
npx component-preview usages src/components/Card.tsx --export Card
npx component-preview serve src/components/Card.tsx --export Card --port 4321   # live page with hot reload
```

## Workflow
1. `list_usages` for the component you changed.
2. `render_component` with the first usage and `in_context: true`; read `errors`, then the snapshot, then the PNG.
3. Edit; render the same target again and read `changes`.
4. `render_usages` before finishing when the component is shared.
