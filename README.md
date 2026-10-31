<p align="center">
  <img src="https://darkworldcoder.github.io/arguseye/assets/og-hero.png" alt="Arguseye: your coding agent can see what it just built" width="1000">
</p>

<p align="center">
  <a href="https://github.com/DarkWorldCoder/arguseye/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/DarkWorldCoder/arguseye?style=flat&color=f97316"></a>
  <a href="https://www.npmjs.com/package/@ayushniroula/arguseye"><img alt="npm" src="https://img.shields.io/npm/v/@ayushniroula/arguseye?color=6476e9"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=ayushniroula.arguseye"><img alt="VS Code Marketplace" src="https://img.shields.io/visual-studio-marketplace/v/ayushniroula.arguseye?label=VS%20Code&color=007acc"></a>
  <a href="https://darkworldcoder.github.io/arguseye/guide.html#license"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-0f172a"></a>
  <img alt="React, Next.js, Vue, Svelte" src="https://img.shields.io/badge/React%20%C2%B7%20Next.js%20%C2%B7%20Vue%20%C2%B7%20Svelte-supported-22c55e">
  <img alt="MCP" src="https://img.shields.io/badge/MCP-server-93c5fd">
  <a href="https://darkworldcoder.github.io/arguseye/guide.html#contributing"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-f8fafc"></a>
</p>

# Arguseye — component previews for agents and VS Code

**See your component. Change it. Inspect the consequences.**

[Watch the 58-second film](https://darkworldcoder.github.io/arguseye/#film) · [Claude Code setup guide](https://darkworldcoder.github.io/arguseye/claude-code-ui.html) · [Agent setup and downloadable skill](https://darkworldcoder.github.io/arguseye/agents.html) · [VS Code extension](https://marketplace.visualstudio.com/items?itemName=ayushniroula.arguseye)

Arguseye gives coding agents eyes on real React, browser-renderable Next.js, Vue 3 and Svelte 5 components (React Router and Remix included), without starting your app or writing stories. It uses your source, installed packages, discovered usage props, and supported layout context. Each render returns a cropped PNG, accessibility text, and structured evidence—including unresolved inputs, warnings, and errors.

```bash
npx @ayushniroula/arguseye install claude
```

Requires Node.js 22+, installed project dependencies, and Chromium or Google Chrome. Run this in your project, then restart your agent. Replace `claude` with `codex`, `cursor`, `gemini`, `windsurf`, `vscode`, `antigravity`, or `copilot`.

If Arguseye saves you a dev-server restart, [a star](https://github.com/DarkWorldCoder/arguseye/stargazers) helps other developers find it.

<p align="center">
  <a href="https://darkworldcoder.github.io/arguseye/#film"><img src="https://darkworldcoder.github.io/arguseye/assets/arguseye-loop.gif" alt="One render_component call: Arguseye reads the project, finds the PricingCard's call site and props, wraps it in the app's layouts and theme, bundles the packages once and renders it. The agent then fixes the button label and the phone preview reflows. Click to watch the 58-second film." width="900"></a>
</p>

<p align="center">
  <a href="https://darkworldcoder.github.io/arguseye/#demo">Explore the interactive demo ↗</a> ·
  <a href="#choose-your-setup">Choose your setup</a> ·
  <a href="#verify-an-edit">Verify an edit</a> ·
  <a href="#tools-mcp-server-arguseye">Tool reference</a> ·
  <a href="#performance-and-boundaries">Performance & boundaries</a>
</p>

## Choose your setup

Expand your client for a copyable recipe. These controls work directly on GitHub; the website has the live demo and installation tabs.

<details open>
<summary><strong>Claude Code</strong></summary>

```bash
npx @ayushniroula/arguseye install claude
```

Writes the project's `.mcp.json` and the skill in `~/.claude/skills/arguseye`. Restart Claude Code, then ask it to preview the component you are editing.

</details>

<details>
<summary><strong>Codex</strong></summary>

```bash
npx @ayushniroula/arguseye install codex --project /path/to/app
```

Adds the MCP entry to `~/.codex/config.toml` and the skill to `~/.agents/skills/arguseye`. Restart Codex to load them.

</details>

<details>
<summary><strong>Cursor, Windsurf, Gemini CLI, or Antigravity</strong></summary>

Choose one command:

```bash
npx @ayushniroula/arguseye install cursor
npx @ayushniroula/arguseye install windsurf
npx @ayushniroula/arguseye install gemini
npx @ayushniroula/arguseye install antigravity
```

The installer merges into the chosen client's existing configuration. See [the installation guide](https://darkworldcoder.github.io/arguseye/guide.html#install) for the exact file locations and verification status of each client.

</details>

<details>
<summary><strong>VS Code and GitHub Copilot</strong></summary>

For the visual editor panel, install [Arguseye from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ayushniroula.arguseye) and run **Preview Component** on a `.tsx`, `.jsx`, `.vue`, or `.svelte` file.

For Copilot's MCP tools:

```bash
npx @ayushniroula/arguseye install vscode
```

This writes `.vscode/mcp.json`. The visual extension and MCP server are two views of the same rendering engine.

</details>

<details>
<summary><strong>CLI or another MCP client</strong></summary>

```bash
# Inspect a component without MCP.
npx @ayushniroula/arguseye shot src/Card.tsx --export Card --out card.png --json

# Print MCP configuration without changing files.
npx @ayushniroula/arguseye install print

# Preview exactly what an installer would change.
npx @ayushniroula/arguseye install codex --project /path/to/app --dry-run
```

Requirements: **Node.js 22+**, installed project dependencies, and a Playwright-compatible Chromium browser or Google Chrome. If no browser is available, install one with `npx playwright install chromium`. Vue projects also need their own `vue/compiler-sfc`.

</details>

The [bundled skill](https://darkworldcoder.github.io/arguseye/guide.html#skill) teaches agents when to render, how to interpret evidence, and how to fall back to the CLI. [All installation options →](https://darkworldcoder.github.io/arguseye/guide.html#install)

## Verify an edit

Capture the component, edit its source, then compare against the saved baseline. The export, resolved props, and viewport stay fixed for the comparison.

<p align="center"><a href="https://darkworldcoder.github.io/arguseye/#demo"><img src="https://darkworldcoder.github.io/arguseye/assets/hero-editor.svg" alt="Illustrative before and after comparison, with highlighted visual changes, accessibility changes, and error evidence" width="1000"></a></p>

<details open>
<summary><strong>Ask your coding agent</strong></summary>

> Render `src/Card.tsx` using its real usage props and save the capture ID. After my edit, compare against that baseline. Show the before, after, and pixel diff; report accessibility changes, new errors, and any incomplete context.

The agent uses `render_component` followed by `render_diff({ baselineId })`. MCP sessions retain the latest **64 captures**; expired IDs require a new baseline.

</details>

<details>
<summary><strong>Save a baseline across CLI commands</strong></summary>

```bash
npx @ayushniroula/arguseye shot src/Card.tsx --export Card \
  --capture-dir .arguseye/baseline --out .arguseye/before.png --json

# Edit src/Card.tsx, then compare its current source.
npx @ayushniroula/arguseye diff --baseline .arguseye/baseline \
  --out .arguseye/comparison --json
```

The comparison directory contains before, after, and highlighted diff images plus JSON evidence. CLI captures persist in the directory you choose.

</details>

**A real result.** On the demo app in this repository, the edit made a boarding pass's gate, seat and boarding values bigger (`text-lg` to `text-3xl`). The diff reported `changed: 3.83% changed pixels` and marked two areas: the bigger values, which were asked for, and the tear line and barcode, which moved down 8 px because the card grew from 338 to 346 px.

<p align="center">
  <img src="https://darkworldcoder.github.io/arguseye/assets/guide/boardingpass-before.png" alt="Before: gate B12, seat 14A, boarding 09:35 in small dark text" width="270">
  <img src="https://darkworldcoder.github.io/arguseye/assets/guide/boardingpass-after.png" alt="After: the same values larger and in indigo" width="270">
  <img src="https://darkworldcoder.github.io/arguseye/assets/guide/boardingpass-diff.png" alt="Pixel diff: the values, the tear line and the barcode marked in pink" width="270">
</p>

Results are **`unchanged`**, **`changed`**, or **`incomplete`**. A visual difference is evidence for review; it does not establish correctness. Runtime props, missing providers, unsupported framework behavior, and assets that did not settle remain visible in warnings and unresolved inputs.

## Why an agent needs eyes

A source diff cannot show clipped text, missing padding, or a theme that failed to apply. Arguseye lets the agent inspect rendered output close to the component it changed.

| Task | Arguseye returns |
|---|---|
| Inspect a component | Cropped PNG, accessibility tree, errors, warnings, and timings |
| Reuse real inputs | Discovered literal props, with runtime expressions reported as unresolved |
| Inspect an edit | Pixel differences, dimension changes, accessibility changes, and new/resolved errors |
| Check other usages | Paginated isolated renders, up to 12 per batch, with individual capture IDs |
| Reproduce a state | Component actions, storage inputs, usage ancestors, or a stand-in parent frame |
| Work in the editor | Unsaved-buffer previews, viewport presets, a light/dark toggle, props controls, and baseline comparison |

<p align="center"><img src="https://darkworldcoder.github.io/arguseye/assets/agent-workflow.svg" alt="Three steps: discover source and usage inputs, render the actual component, then inspect visual and semantic change evidence" width="1000"></p>

These are **isolated component renders using discovered props**, not full-page integration tests. Browser automation and stories remain useful for complete application journeys and explicitly curated states.

## What it looks like

<p align="center">
  <img src="https://darkworldcoder.github.io/arguseye/assets/vscode-panel.png" alt="The VS Code panel: a production home-page section rendered beside its code, scaled to fit, with export, usage and viewport pickers and a props form generated from the TypeScript type" width="900">
</p>

A real Next.js 14 app (MUI, Emotion, Redux, next-auth, 1,197 files), rendered from source with no server running, inside the app's own theme and nested layouts:

<p align="center">
  <img src="https://darkworldcoder.github.io/arguseye/assets/example-home-section.png" alt="A 641-line home-page section rendered headless with the app's theme" width="440">
  <img src="https://darkworldcoder.github.io/arguseye/assets/example-program-card.png" alt="A program card rendered headless with its real cover image and a function prop" width="440">
</p>

## Tools (MCP server `arguseye`)

| Tool | What the agent gets back |
|---|---|
| `render_component {file, export?, usage?, props?, viewport?, theme?, in_context?, frame?, actions?, storage?}` | PNG cropped to the component, accessibility tree, `errors[]`, `warnings[]`, `timings`, `changes` since the previous render of the same target. `usage` takes the props of a real call site; `in_context` renders inside that call site's parent elements; `frame` is a stand-in parent box; `actions` and `storage` set the state first; `theme` forces `light` or `dark` (the `dark` class on `<html>`, `color-scheme` and `prefers-color-scheme`). Function props: `{"$fn": "(x) => …"}`. |
| `list_usages {file, export?}` | Every call site with its literal props, the props that depend on runtime values, and the JSX ancestors. |
| `render_usages {file, export?, viewport?, theme?, cursor?, limit?, output?}` | Paginated isolated call-site renders, up to 12 per batch, with per-usage evidence and capture IDs. |
| `describe_props {file, export?}` | The props schema from the TypeScript type, with sample values. |
| `render_diff {baselineId, output?}` | Before, after, highlighted pixel differences, accessibility changes, errors, and completeness against a `captureId`. |

CLI for agents without MCP: `npx @ayushniroula/arguseye shot src/Card.tsx --export Card --usage app/page.tsx:12 --in-context --out card.png`, `npx @ayushniroula/arguseye usages …`, `npx @ayushniroula/arguseye serve …` (live page with hot reload).

## VS Code

Open a `.tsx`, `.jsx` or `.vue` file and run **Preview Component** (the eye icon in the editor title, or `Ctrl+Alt+P`). The panel shows the component with the props from its first real usage, follows the file you edit, updates unsaved edits while preserving state during ordinary React refreshes and Vue template/style edits, scales the preview to fit (or 1:1), and has a props form built from the component's type. Install it from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=ayushniroula.arguseye) (id `ayushniroula.arguseye`, Linux, macOS and Windows builds), or grab the VSIX from the [releases](https://github.com/DarkWorldCoder/arguseye/releases) for Cursor, Windsurf and VSCodium.

Build targets: **Linux x64, Windows x64, and macOS Apple Silicon**. The following screenshots were captured in the real extension host on Linux, using existing production components from WiseAdmit and CSCA.ai.

<details>
<summary><strong>Real VS Code gallery: responsive layouts, unsaved changes, and CSCA.ai components</strong></summary>

**WiseAdmit — desktop and mobile.** The same existing `AIEcosystem.tsx` component uses its own responsive layout and assets.

![WiseAdmit production source and desktop component preview](https://darkworldcoder.github.io/arguseye/assets/vscode-desktop.png)
![WiseAdmit production source and mobile accordion preview](https://darkworldcoder.github.io/arguseye/assets/vscode-mobile.png)

**Before and after an unsaved edit.** The comparison retains an incomplete-context warning for unsupported Next.js provider behavior.

![Unsaved heading edit with before, after, pixel differences, and context warning](https://darkworldcoder.github.io/arguseye/assets/vscode-compare.png)

**CSCA.ai — existing hero, feature cards, and exam-information grid.** These are the actual `HeroSection.tsx`, `CscaProvide.tsx`, and `ExamEssentials.tsx` from `cscanew/csca`, rendered with their own assets and cached Next font faces.

![CSCA.ai production hero source and component preview in VS Code](https://darkworldcoder.github.io/arguseye/assets/vscode-csca-hero-desktop.png)
![CSCA.ai production feature-card source and preview in VS Code](https://darkworldcoder.github.io/arguseye/assets/vscode-csca-features-desktop.png)
![CSCA.ai production exam-information card grid in VS Code](https://darkworldcoder.github.io/arguseye/assets/vscode-csca-exam-desktop.png)

These are isolated frontend previews, not full application journeys. Next Google font variables can reuse matching font assets from an existing `.next/static` build. Without those assets, root font classes remain unresolved and the render reports incomplete context.

</details>

## How rendering works

- Your files run through [oxc](https://oxc.rs) one module at a time; your packages are pre-bundled once by [Rolldown](https://rolldown.rs) from your own `node_modules` in a worker process and cached by lockfile, so React, MUI and Tailwind are the versions your app uses. Next.js app-router projects run on Next's vendored React, like the app itself.
- Supported root and nested layouts and templates supply context: global CSS, `<html>`/`<body>` classes, providers with their props (`theme={theme}` is re-imported), `CssBaseline`-style siblings. Tailwind v4 compiles with your theme, Tailwind v3 through your PostCSS config, plus Sass, CSS modules, `public/` assets, image imports and `NEXT_PUBLIC_*` env.
- Framework shims handle browser-compatible `next/link`, `next/image`, and `next/navigation` behavior; Chromium draws the pixels. Server-only Next.js behavior is outside this isolated runtime.
- Edits are hot-swapped with React Fast Refresh, from the editor or from disk. A target's whole import graph is preloaded in one batch; barrel imports of icon packages are rewritten per member; lazy images load eagerly so the frame settles in milliseconds.

## Performance and boundaries

The [recorded benchmark](https://darkworldcoder.github.io/arguseye/guide.html#benchmarks) used Linux x64, an Intel Core i5-1235U, and Node v24.21.0 on 2026-10-27. **Twenty warm renders of the small React fixture measured p95 50 ms**, against a ≤100 ms gate. Edit-to-pixels has a separate 50 ms target; it is not a universal latency guarantee.

| Recorded component-edit workflow | Calls | Elapsed | Response size |
|---|---:|---:|---:|
| Arguseye, warm | 2 | 145 ms | 48,669 bytes |
| Playwright MCP + Vite, warm | 4 | 217 ms | 27,298 bytes |
| Arguseye, cold | 2 | 2,105 ms | 49,076 bytes |
| Playwright MCP + Vite, cold | 6 | 1,704 ms | 28,006 bytes |

Arguseye returned a larger evidence bundle, including a pixel diff. This fixture run shows fewer calls and a faster warm workflow, alongside a slower cold path and larger responses. It is not a general performance ranking. [Method, machine, caveats, and raw samples →](https://darkworldcoder.github.io/arguseye/guide.html#benchmarks)

The separate 1,197-file Next.js example above measured server readiness at 2–11 s, first render at 1.5 s, a section at 0.9 s, and the same target again at 0.3 s, with roughly 500–750 MB server memory. These are different workloads. See [the rendering technique](https://darkworldcoder.github.io/arguseye/guide.html#technique).

<details>
<summary><strong>What the isolated runtime cannot reconstruct</strong></summary>

Runtime-only props, arbitrary provider values, authenticated or backend-dependent states, Next.js server execution, and Nuxt features may require explicit inputs or remain unsupported. Successful pixels can still have incomplete context; inspect warnings and unresolved inputs. Vue script changes remount the component and report the state reset. Verification renders start from fresh component state.

</details>

## Roadmap

What an agent would ask for next, in order: layout facts as text (boxes, overflow, clipping, contrast) with refs; element → source file and line; a frozen clock and seeded randomness for diffs you can trust; `next/font` and more framework shims; lower server memory. The full list, with reasoning, is in [docs/agent-wishlist.md](https://darkworldcoder.github.io/arguseye/guide.html#roadmap).

## Contributing

Issues and pull requests are welcome: [CONTRIBUTING.md](https://darkworldcoder.github.io/arguseye/guide.html#contributing) has the setup and the rules, [AGENTS.md](https://darkworldcoder.github.io/arguseye/guide.html#contributing) the engineering rules every change follows (humans and agents alike), [SECURITY.md](https://darkworldcoder.github.io/arguseye/guide.html#security) how to report a vulnerability.

```bash
npm install && for d in test/fixtures/*/; do (cd "$d" && npm install); done
npm test            # unit + headless browser tests
npm run test:vscode # integration test in a real VS Code
```

MIT licensed. Made by [Ayush Niroula](https://github.com/DarkWorldCoder).
