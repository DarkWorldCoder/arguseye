# Component visual diffs in pull requests (0.0.22+)

Arguseye can compare explicitly registered component cases across two checkouts with one saved set of props, viewports, themes, actions and expectations. The CLI accepts `--fail-on-change` for `diff` and `matrix-diff`. These commands require 0.0.22 or later.

```sh
npm ci
npm run build
# Install each application's own dependencies before rendering it.
node dist/cli.mjs matrix /checkouts/base/matrix.json --root /checkouts/base --out /artifacts/base --json
node dist/cli.mjs matrix-diff --baseline /artifacts/base --root /checkouts/head --out /artifacts/head --fail-on-change --json
```

Use fresh artifact directories outside both source checkouts. The second command replays the baseline inputs rather than reading a head-revision plan or rediscovering its props. New version-2 captures record the original project root and a relative target path. Restoration relocates only that target, checks the selected project's file boundary and requires the file to exist. Original snapshots, warnings, source provenance, props and browser fixtures are preserved. Version-1 captures remain usable in their original project; capture them again before moving to another root.

| Result | Default comparison exit | With `--fail-on-change` |
| --- | --- | --- |
| Complete, unchanged, checks pass | 0 | 0 |
| Complete, changed, checks pass | 0 | 1 |
| Render/check failure or incomplete evidence | 1 | 1 |
| Missing baseline or unexecuted matrix case | 1 | 1 |

Available images and JSON are written before the change gate fails. A deliberate UI change stays `changed` in the evidence. Invalid input and inaccessible targets fail with their value or path. Missing case captures remain `not-compared`. Pixel, dimension, accessibility-text and expectation changes are evidence for review; they do not establish correctness or accessibility compliance.

## GitHub Actions example

[The repository workflow](https://github.com/DarkWorldCoder/arguseye/blob/main/.github/workflows/visual-diffs.yml) runs the installed React fixture at base and head SHAs. It builds one Arguseye, installs one Chromium, installs each checkout's own fixture dependencies, captures the plan from base, and uploads available evidence even on failure. The summary includes commit IDs and coverage; `run.json` includes capture environment and tool identity. It uses `pull_request` and read-only repository permissions. Do not give preview code application secrets or a write token.

To adapt the example to another repository, set the first checkout's `repository` to `DarkWorldCoder/arguseye` and its `ref` to `v0.0.22`; it supplies the tool and summary script. Keep the base/head checkouts pointed at your application. Change both install directories, root arguments and the base plan path. The summary helper's plan label is specific to the React fixture, so adapt that label to your registered plan too.

Keep the plan sourced from the base revision for existing checks. The first PR introducing a plan needs an explicit baseline setup: an absent base plan or target fails and must not become a green empty comparison. Review plan edits separately; new checks have no prior baseline.

Both captures must use the same OS, browser, fonts, locale, timezone and capture settings. Browser or runtime differences remain incomplete. Use explicit clock, random and network fixtures for variable UI. Each matrix is limited to 12 cases and 30 seconds; cold startup and dependency installation are separate costs.

## Providers and current scope

Use [project-owned setup](setup.md) to supply actual auth/theme/data providers with deterministic preview state. Storage alone does not recreate an authenticated backend. Missing providers, unresolved inputs, unsettled assets and failed checks remain visible; repairing the head context does not validate an incomplete base capture.

This milestone runs all cases of an explicitly registered plan. Automatic selection from modified files, arbitrary component discovery, PR comments, external review services and large-library scale guarantees remain future work. The workflow must run in GitHub before its hosted behavior can be considered verified.
