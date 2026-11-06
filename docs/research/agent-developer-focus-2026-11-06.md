# Useful evidence for agents and developers

Research and source review: 2026-11-06. This is a delivery decision, not a claim to render every application.

## Priorities

| Area | Reader value | Decision |
| --- | --- | --- |
| Focused DOM and font inspection | Inspect a specific heading, button or late page section without receiving the first 100 unrelated nodes | Implemented in the 0.0.20 candidate |
| Baseline environment identity | Avoid calling pixels unchanged across different capture environments | Implemented in the 0.0.20 candidate |
| Bounded viewport/theme/state matrices | Check responsive and theme variants with explicit coverage and a result budget | Next candidate; not implemented here |
| Unambiguous actions and explicit assertions | Separate successful clicks from expected behavior, especially for portals or repeated labels | Further work; current actions are bounded caller-authored inputs, not an assertion system |
| Project-owned network scenarios | Reuse realistic loading/error/data fixtures without constructing a backend | Further work; exact network-response fixtures already exist, but no new MSW integration is included |

## Why these areas

[Storybook MCP](https://storybook.js.org/docs/ai/mcp/overview) already exposes component context and testing to agents. Its [viewport tools](https://storybook.js.org/docs/essentials/viewport) and [globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) demonstrate explicit environment controls. Arguseye should make source-based verification easier to assess, rather than treat MCP availability as the differentiator.

[Playwright locators](https://playwright.dev/docs/locators) and [assertions](https://playwright.dev/docs/test-assertions) distinguish finding or interacting with an element from verifying behavior. A future action contract should retain that distinction. Arguseye's new inspection selector is only a CSS evidence filter; it does not inherit Playwright locator semantics or assertions.

[Playwright's screenshot guidance](https://playwright.dev/docs/test-snapshots) explains why platform, browser and rendering conditions affect baselines. The candidate records Chromium version, OS/kernel release, architecture, device pixel ratio and Arguseye version, and compares existing locale, timezone, motion and clock/random policies. A difference or legacy baseline without capture metadata produces an incomplete comparison and a recapture warning. This is a useful compatibility check, not a complete font, GPU or hardware fingerprint.

[Accessibility snapshots](https://playwright.dev/docs/aria-snapshots) provide semantic evidence beyond pixels. Byte-identical PNGs still require snapshot/error/context comparison. The candidate skips redundant pixel decoding for exact PNG equality while retaining those checks; an accessibility-label-only edit is covered by a headless regression test.

## Source-grounded changes

- `inspection.selector` filters DOM/source/font evidence within the captured root or portal-inclusive body. It enables layout observations and returns at most 100 matching nodes. Shadow trees and iframe documents remain outside this inspection. Axe still covers the full captured scope.
- A missing or invalid selector preserves the rendered PNG and reports incomplete requested inspection. Actual-font inspection also keeps failures visible. Root/body selectors are now addressable when portals expand the capture scope.
- `environment.capture` travels through CLI JSON, MCP and saved captures. `environmentChanges` explains incompatible comparisons, including legacy metadata. Identical PNG bytes use an independent copy of the after image as the unhighlighted diff.
- Ordinary renders do not enable DOM/font inspection. Capture identity uses the existing layout measurement and runtime data cached at renderer startup.

## Open-source building blocks

[Playwright](https://github.com/microsoft/playwright) (Apache-2.0) and [Storybook](https://github.com/storybookjs/storybook) (MIT) are references for browser evidence and component workflows. [MSW](https://github.com/mswjs/msw) (MIT) is a candidate for project-owned request scenarios. No third-party implementation was copied, no new package was added, and no MSW support is advertised by this release.

## Validation boundaries

Regression tests use the public headless-render seam: late DOM targeting, missing/invalid selectors, portal root fonts, identical-image semantic edits, compatible baselines, mismatched identities and legacy captures. Existing warm-render and live-update limits remain unchanged. Release results, native-platform checks and public registry availability must be recorded separately after verification. Installation, canonical file boundaries, unsupported application-server behavior, and incomplete provider/runtime context are not claimed fixed by these changes.
