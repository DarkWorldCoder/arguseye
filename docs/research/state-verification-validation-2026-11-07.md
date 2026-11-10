# State verification: development validation

Validated on 7 November 2026 on local Linux x64, Node 24.21.0. This is the first delivery from the [feature plan](next-feature-plan-2026-11-06.md), based on `78102c4bd8bd0d211bd54f7966dd83da875745a6`. It is not a registry release. The development archives retain version 0.0.21 for local testing only; the already published 0.0.21 archives were not replaced.

## Delivered

- Strict action targets and explicit capture scope for body-level portals.
- Bounded readiness and expectations, with passed/failed/not-run evidence independent of runtime errors and capture completeness.
- Expectation changes participate in comparisons even when pixels and accessible text match.
- Versioned JSON regression inputs, default omission of browser storage/network bodies, and explicit rejection of incomplete recipes before replay.
- Shared MCP, CLI and VS Code workflows, including saved-check replay against unsaved source.
- README, Marketplace README, agent skill and public guide development notes. Matrix runs, impact analysis and later roadmap items remain proposals.

## Evidence

| Gate | Observed result |
| --- | --- |
| Red to green at existing seams | Observed ambiguity choosing the first target, identical-image comparison ignoring a failed expectation, missing recipe/editor APIs, a render error claiming a passed check, and a mixed checkbox claiming unchecked; the corresponding regressions now pass. |
| Full tests | 49 files, 338 tests passed. Existing warm-render and live-update timing limits were retained. Full run completed 6 November, 228.95 seconds. |
| Type checking | Passed again after package verification on 7 November. |
| Fresh npm installation | Installed the development archive and production dependencies into a new temporary directory; no existing node_modules was copied or linked. |
| Installed MCP | React readiness and expectations passed; exported JSON replayed successfully; unchanged-source comparison returned unchanged. |
| Installed CLI | Passing check exited 0; failed expectation exited 1 with `errors: []`; invalid recipe version exited 1 with structured errors; shot exported a new recipe file. |
| Installed framework fixtures | Vue-only button action/readiness/expectation and native Handlebars heading checks passed with no runtime errors and complete evidence. |
| Existing Geeker codebase | SelectFilter changed from All to Archived; readiness and active-item text expectation passed with no runtime errors. Evidence remained incomplete because the computed `__APP_INFO__` definition was not applied and `virtual:svg-icons-register` was a stand-in. This does not establish whole-app fidelity. |
| Extracted VSIX integration | Passed in VS Code 1.144.0 outside the checkout: mounted preview, fresh checks, save/reopen recipe, comparison detecting a failed expectation after an unsaved edit, and native Handlebars unsaved partial update. |
| Diff hygiene | `git diff --check` passed. Unrelated landing/launch work was excluded. |

The local commands used installed fixture engines, including the available embedded Ruby and fixture gem paths. An earlier unchanged-path browser-startup/timing failure passed in isolation; the final full run passed without increasing deadlines. These results do not establish the cause of earlier timing noise.

## Local development archives

| Artifact | SHA-256 |
| --- | --- |
| `artifacts/state-verification/npm/ayushniroula-arguseye-0.0.21.tgz` | `955c6e2766378718dbf1637247c7cd7b9b9b129942424ae8ba5168f7a87ea18d` |
| `artifacts/state-verification/arguseye-dev-linux-x64.vsix` | `93902bd9f477251839e5ec2d147d087d63524f62f1cbee85ea1b28e3decf6f1f` |

Machine-local receipts are in `artifacts/state-verification/`: archive/install metadata, installed-smoke outcomes and VSIX extraction metadata. Raw accepted-suite and extracted-editor logs were retained there as well. These development artifacts are not public download links.

## Remaining release boundary

Windows x64 and macOS ARM64 have not been executed for this development branch. Native conformance and release workflows now include the readiness/recipe and strict-action browser suites alongside their existing platform checks. Run those gates before merging/releasing, select a new version, rebuild the immutable archives, then verify npm, Marketplace and Open VSX independently. No release tag or registry publication is implied by the local package tests. No social post was published by this feature implementation.
