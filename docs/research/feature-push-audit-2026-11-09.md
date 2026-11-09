# Feature and publication audit — 9 November 2026

This audit separates source pushed to GitHub, merged source, tested development changes and public packages. A successful upload or workflow is not used as proof that a registry serves the version.

## Source state

- Live GitHub `main`: `78102c4bd8bd0d211bd54f7966dd83da875745a6`.
- Live `feat/state-verification` at audit start: `5f62a0b5cdfdf1989ed10dd9ad5604a35645889b`, matching the local branch and open draft [PR #3](https://github.com/DarkWorldCoder/arguseye/pull/3). Explicit checks, strict actions and regression recipes are pushed but unmerged and unreleased.
- Earlier remote feature branches (`agent-preview-improvements`, `feat/focused-render-evidence`, `feat/render-verification-evidence`, `feat/template-previews`, `fix/macos-readiness`, `fix/smarty-capture-clock`) are ancestors of main. The local inferred-layout and scroll-motion fixes are ancestors too.
- Local historical `buffer-global` is not an ancestor as a commit, but its dependency-bundler code and Buffer fixture already match main. Its remaining render-test difference is superseded timing/progress coverage; blindly cherry-picking it would remove newer assertions.
- Unrelated landing/launch changes and generated marketing/video files are preserved and excluded.

## Public versions observed

| Surface | Public version | Evidence |
| --- | --- | --- |
| GitHub release | 0.0.21 | [Latest release](https://github.com/DarkWorldCoder/arguseye/releases/tag/v0.0.21) |
| npm | 0.0.21 | Public registry metadata for `@ayushniroula/arguseye` |
| VS Code Marketplace | 0.0.21 | Public gallery API returns win32-x64, linux-x64 and darwin-arm64 |
| Open VSX | 0.0.18 | Generic and all three platform-specific latest endpoints return 0.0.18 |

The Open VSX gap was already recorded on 6 November: the maker reported successful uploads, but 0.0.21 was not publicly retrievable. Today's public check still does not establish activation. Do not describe all registries as synchronized.

## CI at the original PR head

[Native conformance](https://github.com/DarkWorldCoder/arguseye/actions/runs/42328344263) passed on Linux, Windows and macOS, including extracted native VSIX execution. [Full CI](https://github.com/DarkWorldCoder/arguseye/actions/runs/42328344211) failed one of 338 tests: the Sass additionalData/alias preview timed out at 20 seconds. The same test passed in today's local edge suite; that suite instead observed one incomplete Framer Motion comparison. Neither root cause is established. A successful rerun does not by itself prove a runtime fix.

## Added development behavior

`state: "enabled"` with a required boolean checks enabled or disabled controls using the existing Playwright runtime. It covers native disabled buttons, disabled fieldsets and inherited ARIA-disabled state. Missing or ambiguous controls do not count as disabled. Readiness can wait for enabling; saved recipes, MCP, CLI and VS Code share the same schema and outcomes. This is not proof of visibility, actionability or successful application behavior.

Targets must contain exactly one locator strategy; only role may additionally specify name. Conflicting strategies now fail validation before mounting instead of silently ignoring fields.

Regression coverage uses the approved headless-render seam and existing MCP/editor integrations. The enabled-check path has its own unchanged 100 ms warm-render p95 assertion over 20 renders. No new package or framework runtime was added.

## Next useful deliveries

1. Finish the current verification milestone's merge/release gates before marketing it as available.
2. Bounded viewport/theme/state runs: explicit cells, per-cell inputs, missing-baseline reporting, cancellation and source-revision consistency. Start with at most 12 cells, not an unrestricted Cartesian product.
3. Explain an edit's affected components/usages using indexed dependency paths. Dynamic imports and unvisited relationships remain unknown coverage.
4. Optional matched-style/source evidence for one element, to explain a font, spacing or theme mismatch without increasing ordinary render work.

These later items remain proposals from the existing source-backed feature plan, not implemented APIs.

## Local validation of this follow-up

- Observed the new enabled-state test fail because the enum was unsupported, and the conflicting-target test fail because the renderer accepted and ignored a field.
- Focused renderer/action suites: 15 tests passed.
- Full suite after CPU-idle readiness and native Ruby setup: 49 files, 341 tests passed in 239.02 seconds. Both ordinary render and new enabled-check 20-render p95 limits remain 100 ms.
- Final type checking and build passed.
- VS Code 1.144.1 actual extension-host integration passed, including enabled checks, save/replay, comparison against an unsaved edit, and native Handlebars partial updates.
- Compiled CLI export and fresh replay passed enabled/disabled expectations with `errors: []` and complete evidence.
- A preliminary full run was stopped during heavy concurrent builds; it also lacked the Ruby executable on PATH. The accepted run used the existing embedded Ruby and installed fixture gems, without changing runtime requirements or test deadlines.

Machine: local Linux x64, Intel Core i5-1235U, 12 available logical CPUs, Node 24.21.0. Readiness required three consecutive five-second intervals with at least 75% CPU idle and no more than 25 ms scheduling delay. Local development receipts are retained under `artifacts/state-verification/2026-11-09/` and are not publication evidence.

The Open VSX publisher page was also inspected in Chrome: it still displayed Log In, including after following its existing sign-in link. No packages or permissions were changed. Public availability still requires an authenticated publisher check; no upload success is inferred.

These changes have no version bump or release tag. New Windows/macOS execution and public registry publication must be established independently for a subsequent release.
