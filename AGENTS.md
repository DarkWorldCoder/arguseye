# Arguseye: rules for every agent working here

Arguseye is **eyes for coding agents**: it renders a real component or page from the user's project, looking exactly as it does in their app, with no dev server and no stories. The VS Code panel is the human view of the same engine. Before adding or cutting a feature, read `docs/product.md` (who it's for, what makes it different, what agents need back).

## Workflow: red → green, one slice per commit
1. Write one failing test at an agreed seam. Watch it go **red** for the right reason.
2. Write the least code that turns it **green**.
3. `npm test` and `npm run typecheck` both green, then commit the slice.

Seams (the only places tests go):
- **Preview server HTTP**: `createPreviewServer` (`test/unit/`): what URLs return.
- **Update events + timing**: buffer edits → update messages, inside the speed budget.
- **Headless render**: `createRenderer` (`test/browser/`): `render`, `listUsages`; what an agent gets back.
- **VS Code integration**: command → panel reports mounted; keep to one or two tests.

A test for anything else (a private helper, an internal class) is a new seam: agree it with the human first. Expected values come from the fixture or a literal you worked out by hand. Fixtures in `test/fixtures/<name>/` are tiny real apps with their packages actually installed.

## Speed is the product
- Warm render ≤ 100 ms (enforced by a test); keystroke → pixels target is 50 ms.
- App files go through `oxc-transform` one module at a time. npm packages are pre-bundled once by Rolldown (`DepBundler`) and served from memory. A change only ever re-transforms the edited file.
- Browser, page and server stay **warm**: a new target is swapped in with `__CP__.show(target)`, not a navigation.
- Any change that adds work to the per-render or per-keystroke path ships with a timing assertion.
- Prefer native (Rust/Zig/Go) tools: `oxc-*` for parse/transform/resolve, Rolldown for bundling, Lightning CSS for CSS.

## Fidelity: the user's real code, the user's real packages
- Render the user's actual files with their own `react`/`vue`/Tailwind from their `node_modules`. Only our runtime packages (e.g. `react-refresh`) resolve from this extension (`OWN` in `depBundler.ts`).
- Stub only framework pieces that cannot run outside the app (`next/navigation`, `next/image`…); shims live in `shims/`, one file per module, matching the real module's exports.
- Chromium (Blink) is the rendering engine, so pixels match the user's browser.
- All import resolution goes through `createResolver()` (`src/server/resolver.ts`), the single resolver config.

## Code shape
- `src/server/`: preview HTTP server, module graph, dependency bundler, page runtime. `src/agent/`: headless renderer, MCP server, CLI. `src/usages/`: static analysis of the user's code. `src/extension/`: VS Code.
- One concept per file, named after its main export in camelCase (`createRenderer.ts`, `findUsages.ts`). Public API = a `createX` factory returning a plain object of type `X`; classes are for internal stateful pieces (`ModuleGraph`, `DepBundler`).
- ESM with `.js` suffixes on relative imports (NodeNext).
- Code that runs in the preview page lives as template strings in `src/server/page.ts` and reaches the browser untranspiled: write plain modern JS there.
- Each export gets a one-line doc comment saying why it exists; other comments explain a non-obvious *why*.

## What agents get back
- Every render returns `errors: string[]` with stacks and file paths. Render failures land there, so the agent can read them and fix the code. Invalid input (an unknown usage id, missing export) throws an `Error` naming the exact value.
- Output is token-cheap: PNG cropped to the component, snapshot from the accessibility tree, ids an agent can pass back verbatim (`app/page.tsx:9`).

## Commits
- Use the repo's git identity (already set in `.git/config`). The message is one line saying what the slice gives the user. The commit carries only the author: no co-author or generated-by trailers.
