# Component visual diffs in pull requests

Status: the 0.0.22 candidate implements capture relocation, the CLI change policy and a registered-case pull-request workflow. Hosted validation and registry publication are tracked in the release record. Automatic changed-file selection and large-library scale validation remain future work.

## Outcome

A pull request gets reproducible component-level before/after images, highlighted pixel differences, dimension changes, accessibility-text differences, behavioral check results, and explicit context gaps. Run the real project code and installed packages without starting the application server or requiring stories. Preserve existing local preview latency.

Ship in small commits. The first milestone compares explicitly selected matrix plans across two revisions. The next milestone selects those plans conservatively from changed files. Do not describe the first milestone as automatic impact analysis or publish these development APIs as available in npm 0.0.21.

## Existing foundation and gaps

| Area | Available in source | Work needed |
| --- | --- | --- |
| Fixed inputs | `renderMatrix` / `diffMatrix` replay resolved props, viewport, theme, actions, storage and expectations | Keep one baseline's inputs fixed across revisions; do not rediscover props on the head revision |
| Comparison | Pixels, dimensions, snapshots, expectations, errors, warnings and capture-environment identity | Add an explicit CI policy for changed evidence; preserve incomplete evidence as a separate result |
| Exit status | `check` fails on failed/incomplete checks; matrix commands fail on incomplete/failed cases | `diff` and `matrix-diff` currently allow visual changes to exit successfully |
| Saved captures | CLI capture directories and matrix manifests | Captures contain absolute target paths; support a different checkout root without rewriting arbitrary evidence |
| Artifact safety | Matrix commands require a new output directory | Keep baselines immutable and make partial outputs explicit; do not claim `shot`/`diff` already refuse overwrites |
| Provider context | Project-owned setup, reconstructable wrappers, explicit fixtures and context warnings | Exercise realistic nested provider cases and document deterministic state setup |
| Impact selection | Incremental usage index and module graph | No complete public per-case dependency manifest or changed-file selector yet |

## Slice 1: replay captures in a different checkout

Use a versioned persistence contract that records the original project root and a project-relative target. Restore that target under the selected root, checking containment through the existing file-access boundary. Preserve original source provenance, environment identity, warnings, unresolved inputs and checks. Do not perform global string replacement on props, fixtures, snapshots or diagnostics. Legacy captures must either continue to work at their original root or fail with an actionable migration message.

Red test at the existing **headless renderer** seam: capture a real installed fixture, persist it, restore it in a second fixture checkout, and compare through `createRenderer.diffMatrix`. Assert unchanged pixels/snapshot and the new target location. Then edit the second checkout's component and assert a changed result with the original props and viewport. Assert that the original capture remains unchanged. Add containment, missing-target and unresolved-provider cases through the same seam as needed.

Keep relocation outside ordinary rendering. Establish the persistence/restore contract before wiring CLI input paths. Do not silently remove environment mismatches to make CI pass.

## Slice 2: explicit CI change policy

Add `--fail-on-change` to `diff` and `matrix-diff`. The default remains review-only for complete visual changes. With the flag, detected pixel, dimension, accessibility-text or expectation changes produce exit code 1. Render failures, failed readiness/expectations, incomplete context, missing baselines and unexecuted cases also fail. Malformed commands fail with an actionable message. Write available comparison artifacts before returning a failing gate.

| Evidence | Default comparison | With `--fail-on-change` |
| --- | --- | --- |
| Complete, unchanged, all checks pass | 0 | 0 |
| Complete, changed, all checks pass | 0 | 1 |
| Render/check failure | 1 | 1 |
| Incomplete context or environment mismatch | 1 | 1 |
| Missing baseline, cancelled or not-run case | 1 | 1 |

Keep the raw evidence status separate from the gate policy: a deliberate visual edit remains `changed`, not a fabricated render error. Accessibility-text changes are evidence, not an accessibility compliance verdict.

Validate the complete/changed/incomplete/failed evidence through `createRenderer` using literal fixture expectations. A dedicated CLI exit-code test is a new seam under `AGENTS.md`; agree that seam before adding automated CLI tests. Until then, exercise built CLI exit codes as a manual acceptance check, including unchanged output, a real style/text edit, a failed expectation and a missing baseline. Do not test a private policy helper instead.

## Slice 3: runnable pull-request workflow and artifacts

Add a documented workflow template, then exercise it on this repository's installed React fixture. Use `pull_request` with read-only repository permissions. Render base and head code in separate processes/checkouts with their own lockfile-installed dependencies; use the same Arguseye build, Chromium, OS, locale, timezone, fonts and capture policy. Resolve base/head SHAs as data rather than interpolating pull-request text into shell commands. No application secrets or write token are required.

Keep the workflow's matrix plan fixed from the base revision for existing checks. New targets without a base render must appear as unbaselined rather than passing. Plans changed by the PR require explicit review; a PR must not silently redefine the props or expectations used to compare its own existing baselines.

Capture both revisions during the same job rather than comparing a developer laptop baseline to Linux CI. Use explicit stable clock/network/random fixtures where the UI needs them. Known environment changes and unsettled assets remain incomplete. Install the actual project's dependencies in each checkout; report dependency changes as part of the revision being reviewed.

Upload artifacts even when comparison fails: manifest, available before/after/diff PNGs, errors and per-case status. Include base/head commit IDs, plan identity, tool/browser identity, requested/executed/compared counts and artifact paths in the job summary. Escape project-derived text in summaries. Keep output directories outside source checkouts and preserve baseline files. A failed base render is not permission to skip a check or establish a new passing baseline.

Acceptance: an unchanged fixture passes, a padding/text edit fails with evidence, a provider/setup failure remains incomplete/failed, and a missing capture stays not-compared. Document that the example uses the development build until a published release contains these commands. Automated PR comments and external review services are outside this milestone.

## Slice 4: conservative changed-file selection

Record observed per-case source dependencies explicitly. Existing session-wide source fingerprints are not a complete dependency map and must not be used to assert an unrelated component is unaffected. Include target imports, call-site ancestors when used, setup/provider imports, global CSS, assets, relevant configuration and lockfiles.

Read changed paths from a base/head Git diff with NUL-delimited output and explicit rename/deletion handling. Select registered plans whose dependencies intersect changed files. A shared provider, global stylesheet, resolver configuration or lockfile change selects every potentially affected plan. Unknown/dynamic dependencies trigger a conservative wider run and an explanation. Use dependency evidence from both revisions so additions and deletions cannot disappear from coverage.

Report every plan as selected, unaffected with evidence, unbaselined or unclassified. A zero-selection result must name its reason; unclassified changes cannot become a green "no regressions" result. Start with registered matrix plans; discovering arbitrary new component exports and suitable call-site inputs is a later extension. Bound plans/cases explicitly and report overflow rather than silently truncating work.

Red tests stay at the headless-render seam: a leaf edit affects its registered case, a shared CSS/provider edit affects all dependents, unrelated fixture changes have an explained exclusion, and renamed/deleted targets remain visible. If Git selection needs its own automated test seam, agree that boundary before introducing it.

## Slice 5: provider reliability and scale evidence

Use project-owned setup to compose actual authentication/theme/data providers with explicit deterministic fixture state. Cover nested providers, theme state, signed-in/signed-out states, asynchronous readiness, provider import edits and missing context. Never imply that providing storage reconstructs a real authenticated backend. Preserve inferred-context gaps until explicit setup repairs them; a repaired head cannot retroactively validate an incomplete baseline.

Validate with a real large Next.js project and an installed component-library fixture. Record cold installation/startup separately from warm rendering, usage indexing, selected-plan count, total CI time, peak memory and artifact bytes. Reuse one warm renderer per revision and batch within the existing 12-case/30-second bounds. Do not navigate/restart the browser for each case or put impact indexing in the keystroke path.

Any new per-render/per-edit work needs its timing assertion. Retain warm p95 ≤100 ms over 20 renders and the strict live-update budget; explain failures rather than relaxing thresholds. If representative large-project performance misses these gates, publish that limitation and investigate before claiming scalability.

## Completion gates

For each implementation slice: observe its failing test at an approved seam, implement the smallest fix, run `npm test` and `npm run typecheck`, then commit only that slice with the configured repository identity. Preserve pre-existing edits, especially `test/browser/live.test.ts` and the launch/research work. No feature commit should claim tests passed while dependency installation is unavailable.

Before calling CI integration complete: run the built CLI across base/head checkouts, inspect saved images and JSON, verify exit codes for every policy row, exercise the workflow, and update `docs/product.md`, `docs/rendering.md` and README with exact implemented scope and release status. Automatic impact selection and large-library/provider validation remain separate acceptance gates, not implied by a working matrix workflow.
