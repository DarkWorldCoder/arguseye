# Changelog

## 0.0.3

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
