# Launch plan: Arguseye

## Positioning
One line: **Your coding agent can see what it just built.** Category: eyes for coding agents (a rendering tool for AI agents), not a Storybook alternative. The proof points are measurable: one call instead of six to ten, 40 ms warm renders, a production Next.js app rendered from source with its theme, and a measured `changes` figure after every edit.

## Audiences and the one thing each cares about
| Audience | What they feel today | What to show first |
|---|---|---|
| Claude Code / Codex / Cursor users shipping UI | "The agent said done and the button was broken" | the hero: a real edit, the preview updating, recorded visual change evidence |
| Teams running agents in CI or on large codebases | "Every visual check means booting the app" | `render_usages` across call sites; 1,197-file app numbers |
| VS Code users (humans) | "I restart the dev server to see a small change" | the editor loop: typing, supported state preservation and measured project-specific latency |
| MCP tool builders and plugin authors | "What can my agent call?" | the tools table, `npx @ayushniroula/arguseye install print` |

## Launch sequence
1. **Make the repo public**, upload the social preview, pin the hero.
2. **npm publish** so `npx @ayushniroula/arguseye install claude` works for everyone. **VS Code Marketplace + Open VSX** so the panel is one click.
3. **MCP registries and directories**: the official MCP Registry (`server.json` in the repo; `mcp-publisher login github` then `mcp-publisher publish`), Smithery, mcp.so, PulseMCP, Glama, the Awesome MCP Servers lists; Claude Code plugin marketplace is the repo itself; Antigravity plugin via `agy plugin install`.
4. **Show HN**: "Show HN: Arguseye – eyes for coding agents: render any React/Next/Vue component as the app does, no dev server". Lead with the real-app hero and the benchmark; answer "why not Storybook/Playwright" in the first comment.
5. **X thread** (6 posts): the problem (agents build UI blind) → the 1-call demo GIF → the real production app render → `changes` after an edit → install one-liner per agent → repo link. **LinkedIn**: the "agent wrote it, nobody looked" story.
6. **Reddit**: r/ClaudeAI, r/cursor, r/ChatGPTCoding, r/nextjs, r/reactjs, r/vuejs (one post each, adapted, with the install line for that audience's agent).
7. **Product Hunt** a week later, once issues from HN are fixed; the hero SVG as the first gallery item, the VS Code loop as the second.
8. **Directories**: Futurepedia / TAAFT (AI tools), AlternativeTo (Storybook, Preview.js), the VS Code "AI" collection.

## Demo assets (all in `assets/`, all made from code)
- `hero.svg`: real production section, desktop + mobile, real edit, measured change (plays on GitHub).
- `hero-editor.svg`: the VS Code loop with state kept.
- `vscode-panel.png`, `example-home-section.png`, `example-program-card.png`.
- `social-preview.png` 1280×640, `banner.svg`, `icon.png`.
To record a video: `arguseye serve` plus screen capture of the panel; the same edit used in the hero (`AIEcosystem.tsx` line 27) is reproducible.

## Messages that are true today (use these)
- Renders a 641-line production section with MUI, Emotion, Redux and next-auth providers, 0 errors.
- First render on a 1,197-file app: 1.5 s; warm: ~40 ms; server ~500–750 MB.
- Works with Claude Code, Codex, Cursor, Windsurf, VS Code Copilot, Antigravity, any MCP client; one install command.
- React, Next.js (app router, vendored React), Vue SFCs.

## Messages to avoid until they are true
- "Any framework" (Svelte, Angular, Solid are not supported yet).
- "Pixel-perfect" (we render with Chromium; fonts and lazy images are handled, but we do not claim bit-identity with every browser).
- Any number not in `benchmarks/` or the README.

## Objections and answers
- *Storybook does this.* Storybook needs stories and its own server; Arguseye renders the component as your app uses it, from the code you already have, in one agent call.
- *I can use Playwright MCP.* Only against a running app, with login and navigation; and it shows saved files. See the benchmark.
- *Does my code leave my machine?* No. Local server on 127.0.0.1, local Chromium.
- *Is it safe to run on untrusted repos?* Same risk as running their dev server (it executes the component's code). Said plainly in SECURITY.md.
