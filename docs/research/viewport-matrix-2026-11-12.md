# Focus: one component edit across explicitly selected contexts

## Evidence and scope

- A real developer asked for automated multiple-viewport runs in [Storybook discussion #24942](https://github.com/storybookjs/storybook/discussions/24942); follow-up discussion also asks about themes. This is a historical 2023–2024 request, not proof that current Storybook lacks such testing.
- The [IBM MCP Context Forge UI test epic #2519](https://github.com/IBM/mcp-context-forge/issues/2519) explicitly includes responsive and visual testing. Agent Reach retrieved the public issue through its GitHub channel on 2026-11-12. It is evidence of a development workflow, not an Arguseye customer endorsement.
- [Chromatic's visual-test addon](https://github.com/chromaui/addon-visual-tests) is existing precedent for visual tests across contexts. Arguseye's scope remains local source-file rendering without authored stories, using its existing evidence contracts.
- Agent Reach's GitHub channel does not support discussions: the discussion read returned BAD_INPUT. Its text was obtained through public web search instead. No account connections, paid services or posting were used.

## Implemented development slice

An agent edits a pricing card or form and needs to review mobile/desktop, light/dark, or explicit content states without starting the application. Previously each context required a separate render and manual bookkeeping of baselines. A bounded matrix now serializes 1–12 caller-selected contexts and returns independent captures, checks and coverage. Matching baseline comparison uses recorded inputs rather than current guessed props.

The implementation shares the existing engine through MCP, persisted CLI directories and VS Code's four-context preset. It does not infer design intent or declare a visual difference a bug. Missing providers, sampled/runtime props, fonts/assets and framework limitations remain visible. Source changes registered during a batch make it incomplete. Completed evidence survives cancellation, pending cases remain not-run, and absent baselines remain not-compared. Existing session budgets and the ordinary single-render timing limit remain unchanged.

## Useful follow-on areas (not implemented here)

1. Affected-target planning: identify component usages affected by a shared style or component change, then let callers select matrix cases. The current slice does not claim dependency impact coverage.
2. Explicit overflow expectations: reuse existing bounded geometry inspection to let callers assert selected containers have no horizontal overflow. Observation already exists; a deterministic assertion contract needs a separate slice.
3. User-authored state catalogs: name and replay a small reviewed set of data/state recipes without reconstructing backend state. Existing recipes provide the foundation; automatic data inference remains out of scope.

See [the development contract](../rendering.md#viewport-theme-and-state-matrices-unreleased) for exact inputs, commands, budgets and incomplete evidence semantics. Registry 0.0.21 does not contain these APIs; no release is implied by this work.

## Validation

- Full suite: **352 tests, 50 files passed** using `npm test -- --maxWorkers=1 --no-file-parallelism`; the existing timing limits were unchanged. Serial execution avoided adding contention to the active video workload.
- Type checking and the bundled build passed.
- Actual Linux VS Code 1.144.1 extension-host integration passed: mounted preview, unsaved edits, four-case matrix capture and four matching comparisons, plus existing native-template workflow.
- The built CLI rendered the existing local Geeker `src/components/TreeFilter/index.vue` against its installed packages in 390×844/light and 1280×800/dark. Both rendered the supplied Teams/Engineering/Design input without render errors. Cold batch: 7157 ms; fresh-process baseline comparison: 5025 ms, zero changed pixels in both cases. These are two observations on the loaded Linux workstation, not a benchmark or performance promise.
- Both Geeker cases correctly remained incomplete because a computed Vite `__APP_INFO__` define and the virtual SVG registration module were approximated. Matching pixels did not clear those warnings.
- Local evidence: `/tmp/arguseye-geeker-matrix-baseline/matrix.json`, `/tmp/arguseye-geeker-matrix-comparison/matrix.json`; per-case capture/diff PNGs are adjacent. No application server was started.
- Windows/macOS execution, public package installation and registry publication were not performed for this unreleased slice.
