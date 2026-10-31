# Changelog

## 0.0.9

- `theme: "light" | "dark"` on `render_component`, `render_usages`, `arguseye shot --theme` and a Theme picker in the VS Code panel. `dark` adds the `dark` class to `<html>`, sets `color-scheme` and (headless) emulates `prefers-color-scheme`; `light` removes the class; without it the app renders as written. Baselines record the theme, so `render_diff` compares like for like.

## 0.0.8

- An agent's edit on disk is no longer hidden by a usage lookup. `render_usages`, `list_usages` and the export lookup read the edited file before the render checked for changes, so the render showed the old component and Tailwind never generated the edit's new classes (`render_diff` then reported "unchanged"). Found by a Claude Code session that refused to call its task done.
- `render_diff` and `arguseye diff` replay the baseline's parent box: a baseline rendered `in_context`, inside a `frame`, or with actions or storage is re-rendered the same way. Before, the after-render dropped them, so an unchanged component in context reported ~100% changed pixels. Found by a second Claude Code session, which checked the PNG hashes and called the number wrong.
- Screenshots are cropped to the component's width as well as its height: a 340 px card is captured 340 px wide instead of as wide as the viewport (about a quarter of the pixels, so fewer image tokens for agents). Frames and in-context renders keep their parent box.

## 0.0.6

- Live preview no longer blinks text while you type: `@font-face` rules keep their own stylesheet, so an edit that regenerates the CSS (for example a new Tailwind class) does not recreate and reload the fonts.
- `render_component`, `render_usages`, `list_usages`, `describe_props` and `arguseye shot` pick the file's component when no export is named: the default export, else the first PascalCase export. Named-export components no longer need `--export`.

## 0.0.5

- npm package carries `mcpName` for the official MCP Registry; `server.json` on the 2025-12-11 schema.

## 0.0.4

- Reconstruct imported root Next Google font variables using matching cached font faces from the project's `.next/static` build; keep missing font context visible.
- Add genuine VS Code captures of WiseAdmit's responsive section and unsaved-edit comparison, plus CSCA.ai's existing hero, feature cards, and exam-information grid.
- Clarify the Windows x64, macOS Apple Silicon, and Linux x64 release targets and the screenshot validation platform.

## 0.0.3

- Publish the CLI and MCP server as `@ayushniroula/arguseye`; generated client configuration, documentation, skills, plugins, and release automation use that registry package while the extension retains `ayushniroula.arguseye`.

- Fix Marketplace screenshots by serving real VS Code and component images from public Pages URLs instead of the private repository.
- Interactive product site, expandable README setup guides, accessible SVG workflow and comparison illustrations, and public installation/compatibility/benchmark documentation.
- npm release archive includes its documentation and visual assets; release manifests and lockfile agree on 0.0.3.

## 0.0.2

- Gemini CLI install target; required function props get a stand-in in sample props; Marketplace publishing through trusted publishing; project site at darkworldcoder.github.io/arguseye.

## 0.0.1 (unreleased)

First public version.

- Headless renderer, MCP server (`render_component`, `list_usages`, `render_usages`, `describe_props`, `render_diff`) and CLI (`shot`, `usages`, `serve`, `mcp`, `install`).
- Real props from call sites (through barrels and aliases), props schema and samples from TypeScript, function props as `{"$fn": …}`.
- Fidelity: root and nested layouts and templates with their providers, global CSS, Tailwind v3/v4, Sass, CSS modules, assets, `NEXT_PUBLIC_*`, Next's vendored React, `next/link`, `next/image`, `next/navigation` shims, Vue single-file components.
- States: `actions` before capture, `storage`, viewports, parent box (`in_context`, `frame`), `changes` since the last render.
- Speed: one transform per file version, worker-process dependency bundling with an on-disk cache, modulepreload, route pre-warm, barrel import rewrite, eager lazy images.
- VS Code panel: follow the active file, live updates with state kept, props form, Fit / 1:1, usage and viewport pickers, baseline compare.
- Installers for Claude Code, Codex, Cursor, Windsurf, VS Code / Copilot, Antigravity; Agent Skill; Claude Code and Antigravity plugin manifests.
