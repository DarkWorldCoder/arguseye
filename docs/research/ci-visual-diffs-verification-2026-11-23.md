# CI visual comparison verification, 2026-11-23

The local development implementation compares registered component cases across project checkouts. It relocates the saved target path and replays the base inputs. CLI comparisons accept `--fail-on-change`, retain available artifacts before returning a failing status, and preserve failed baseline expectations.

This is unreleased work. Automatic selection from modified files and hosted GitHub Actions execution remain unverified. No package was published and no feature commit was made: the repository requires the full test suite to pass before committing.

## Verification

| Check | Result |
| --- | --- |
| Build | Passed |
| Type check | Passed |
| CI capture, matrix and capture-environment tests | 14 passed across 3 files |
| Built CLI acceptance checks | 14 passed |
| Full suite | 350 passed, 5 failed across 51 files |
| Full-suite failures | Five Ruby template cases; the runtime could not start because `ruby` is absent (`spawn ruby ENOENT`) |
| Performance checks in the final full run | Passed |
| Whitespace validation | Passed |

The cross-checkout regression failed before target relocation was implemented. A second regression reproduced a repaired head expectation being reported as `changed` despite a failed baseline; the final implementation reports that case as failed.

The command checks covered unchanged output, changed output with and without the CI option, single-capture comparisons, accessibility-only changes, failed expectations, a repaired head with a failed baseline, broken provider setup, capture-environment mismatch, missing captures and invalid option use. Missing cases remained `not-compared`. The baseline inputs stayed fixed.

A padding edit changed 10,775 pixels and increased the captured dimensions from 374 × 117 to 374 × 137. Changing only a button's accessible label changed zero pixels and changed the accessibility snapshot. Both changes failed with the CI option enabled.

The renderer tests also covered actual nested auth/theme providers across checkouts, a provider edit and missing auth context. These fixtures do not establish compatibility with arbitrary application providers or a live authenticated backend.

Evidence is saved in `output/ci-visual-diffs-2026-11-23/`: `full-test-final.log`, `acceptance-final.log`, the latest run's `acceptance.json`, comparison PNGs and JSON, and `job-summary.md`. The summary was exercised locally, including rejection of an invalid revision string. The workflow has not run on GitHub.

## Publication

Published as development updates with unreleased scope stated in the text:

- [LinkedIn](https://www.linkedin.com/feed/update/urn:li:activity:7530624066005950464/)
- [Medium](https://medium.com/@ayushniroula08/building-component-level-visual-checks-for-pull-requests-in-arguseye-b6fc900939b9)
- [DEV Community](https://dev.to/ayushniroula/building-component-level-visual-checks-for-pull-requests-in-arguseye-4jph), with the Medium article as its canonical source and an AI authorship disclosure

The [Reddit submission](https://www.reddit.com/r/SideProject/comments/1y3ibyb/im_adding_pr_visual_checks_to_arguseye_including/) was created, then removed by Reddit's filters. It was not reposted. Publication screenshots are saved beside the verification evidence.
