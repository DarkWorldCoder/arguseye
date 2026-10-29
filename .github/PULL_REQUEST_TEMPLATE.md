## What the user gets

One or two sentences, the way the commit message says it.

## Seam and test

Which agreed seam the test lives at (server HTTP, update timing, headless render, MCP, VS Code) and what it asserts.

## Checks

- [ ] `npm test` and `npm run typecheck` pass
- [ ] Per-render / per-keystroke path unchanged, or a timing assertion is included
- [ ] Renders the user's real code and packages (no mocks of their app)
