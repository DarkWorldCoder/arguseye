# Contributing to Arguseye

Thanks for helping agents see. This page is the short version; the rules every change follows are in [AGENTS.md](AGENTS.md) (they apply to humans too).

## Set up

```bash
git clone https://github.com/DarkWorldCoder/arguseye && cd arguseye
npm install
for d in test/fixtures/*/; do (cd "$d" && npm install); done
npx playwright-core install chromium-headless-shell   # or have Chrome installed
npm test              # unit + headless browser tests
npm run test:vscode   # the panel in a real VS Code (downloads one on first run)
```

Node 22 or newer. Linux, macOS and Windows should all work; the native pieces (oxc, Rolldown, Lightning CSS) ship binaries for each.

## How changes land

1. Open an issue first for anything bigger than a fix, so the approach is agreed before code.
2. Work test-first at one of the agreed seams (preview server HTTP, update timing, headless render, MCP contract, VS Code suite). A failing test comes before the code that makes it pass.
3. Keep the speed budgets: a warm render stays under 100 ms in the test, and anything on the per-render or per-keystroke path ships with a timing assertion.
4. Fidelity first: render the user's real code with the user's real packages. Shims are for framework modules that cannot run outside the app, and they mirror the real module's exports.
5. One slice per pull request, `npm test` and `npm run typecheck` green, a one-line commit message saying what the user gets.

## Good first contributions

- A framework shim that is missing (`next/font`, `next/script`, Vue router stubs).
- A barrel package to add to the per-member import rewrite.
- A fixture app that reproduces a styling setup we don't cover yet (CSS-in-JS libraries, Less, UnoCSS).
- Items from [docs/agent-wishlist.md](docs/agent-wishlist.md): layout facts with refs, element → source, a frozen clock for deterministic diffs.

## Reporting a bug

Use the bug template. The most useful report includes the component file, how it is used (`list_usages` output), the `errors[]` and `warnings[]` from the render result, and the framework versions from your `package.json`.
