# Component Preview

**Eyes for coding agents.** See any React, Next.js or Vue component rendered exactly as it looks in your app, with no dev server, no stories and no mocks. Real props come from where your code already uses the component. An MCP server and a CLI let Claude Code, Codex, Cursor or any agent look at what they just built in one call; a VS Code panel shows the same preview beside your code and updates on every keystroke.

> Status: early. React and Next.js work on real projects (tested on a Next 14 + MUI + Emotion + pnpm app). Vue is next. See [docs/product.md](docs/product.md) for the plan and what makes this different from Storybook, Preview.js and agent-feedback tools.

## For agents (MCP)

```bash
npm install -g component-preview
```

Claude Code:

```bash
claude mcp add component-preview -- component-preview mcp --root /path/to/your/app
```

Any MCP client (`.mcp.json`, Cursor, Codex):

```json
{ "mcpServers": { "component-preview": { "command": "component-preview", "args": ["mcp", "--root", "/path/to/your/app"] } } }
```

Tools:

| Tool | What the agent gets back |
|---|---|
| `render_component {file, export?, usage?, props?, viewport?}` | PNG cropped to the component + its accessibility tree + `errors[]` with file paths. With neither `usage` nor `props`, required props are filled with samples from the TypeScript type. |
| `list_usages {file, export?}` | Every call site in the project (`app/page.tsx:9`) with the literal props it passes, and the props that depend on runtime values. |
| `render_usages {file, export?, viewport?}` | The component rendered at every call site with each one's real props: the blast radius of a change in one call. |
| `describe_props {file, export?}` | The props schema from the TypeScript type (kind, enum options, defaults, doc comments) and the sample props. |

A warm render takes about 40 ms. A changed file is picked up on the next call, saved or not, with no restart.

## CLI

```bash
component-preview shot src/components/Card.tsx --export Card --usage app/page.tsx:12 --out card.png
component-preview usages src/components/Card.tsx --export Card
```

## VS Code

Open a `.tsx`, `.jsx` or `.vue` file and run **Preview Component** (the eye icon in the editor title, or `Ctrl+Alt+P`). The panel renders the component with the props from its first real usage, follows the file you are editing, re-renders in under 50 ms as you type (unsaved, component state kept), and has a props form built from the component's type.

## How it stays exact and fast

- Your files run through [oxc](https://oxc.rs) one module at a time; your packages are pre-bundled once by [Rolldown](https://rolldown.rs) from your own `node_modules`, so React, MUI, Tailwind are the versions your app uses.
- Your root layout's global CSS, `<html>`/`<body>` classes, Tailwind v4 (compiled with your theme) or Tailwind v3 via your PostCSS config, Sass, CSS modules, `public/` assets and image imports all apply.
- `next/link` and `next/image` render the markup Next renders. Chromium (via Playwright) does the pixels.
- Edits are hot-swapped with React Fast Refresh. Every package a component needs is bundled before the first paint, so there is one React per page.

## Development

```bash
npm install
for d in test/fixtures/*/; do (cd "$d" && npm install); done
npm test            # unit + headless browser tests (Chrome or Chromium)
npm run test:vscode # integration test in a real VS Code
```

Rules for contributors and agents are in [AGENTS.md](AGENTS.md). MIT licensed.
