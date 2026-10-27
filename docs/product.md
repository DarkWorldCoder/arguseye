# Product: why Component Preview exists

## The problem
AI agents (and people) write components, then can't see them without starting the dev server, restarting it after some changes, navigating to the right route, logging in and clicking to the right state. Agents burn 6–10 tool calls and lots of tokens to look at one card, or skip looking at all.

## The promise
See any React, Next.js or Vue component or page, rendered exactly as in the app, in milliseconds: no dev server, no stories, no mocks.

## What makes us different (every feature serves one of these)
1. **Real props from your own code**: every JSX usage in the project becomes a variant (`app/page.tsx:9`) with the props written there.
2. **Keystroke speed, state kept**: unsaved edits appear in < 50 ms via Fast Refresh.
3. **Pixel-true app context, zero config**: root layout globals, Tailwind, `next/font`, providers detected automatically.
4. **React + Next.js + Vue in one maintained tool.**
5. **Built for agents**: MCP + CLI return a cropped PNG and a text snapshot; `render_diff` (before/after of an edit) and `render_usages` (every usage after a change) exist nowhere else.

## Why an agent picks us
One call instead of 6–10 · works when the app can't boot (env, backend, auth, other broken pages) · sees unsaved code · reaches every real usage, state, viewport in one call · token-cheap output · self-check with `render_diff` · errors with file paths · zero setup.
We prove it with an in-repo benchmark: same task, our MCP vs Playwright MCP + `next dev`: tool calls, tokens, wall time.

## Landscape (checked Oct 2026)
- Storybook MCP (`@storybook/addon-mcp`, preview): React only, needs the Storybook server and written stories.
- Stagewise, Onlook, Agentation, react-devtools-mcp, Expo MCP: work on your *running* app.
- Preview.js: closest idea in the editor (React/Vue/Svelte), stale since 2024, random props from types.
- Marketplace previewers (Glance, JSX Preview, React File Preview, DevPreview, React Component Preview): React only, render on save, no real props.
- Lightpanda (no rendering → no screenshots), Servo 0.1 (embeddable, React fidelity unproven): not used; Chromium stays the engine.
