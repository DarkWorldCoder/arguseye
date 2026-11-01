# Measured component-edit workflow

Run `npm run benchmark` after installing the root and React fixture dependencies. The script copies the installed fixture into temporary projects and uses real stdio MCP clients. Source edits never touch the fixture itself. Raw results are in `latest.json`.

The task is to capture `ProductCard` with title `Desk` and price `3`, edit its button label, and inspect the rendered result. Playwright receives a minimal Vite app with a known URL and no login. Arguseye renders the source directly and also returns an automated pixel/semantic comparison.

## Result: 2026-10-27

Linux x64; Intel Core i5-1235U; 12 logical CPUs; Node v24.21.0. All four workflows verified the expected result.

| Workflow | Tool calls | Startup | Workflow | Total | Response bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Arguseye, cold | 2 | 1,172 ms | 933 ms | 2,105 ms | 49,076 |
| Playwright MCP + Vite, cold | 6 | 576 ms | 1,128 ms | 1,704 ms | 28,006 |
| Arguseye, warm | 2 | 0 ms | 145 ms | 145 ms | 48,669 |
| Playwright MCP + Vite, warm | 4 | 0 ms | 217 ms | 217 ms | 27,298 |

Arguseye returned four images across the two calls: initial capture, before, after, and highlighted changes. Playwright returned two component screenshots. The response sizes therefore compare different evidence bundles. Both workflows included accessibility text; Arguseye also included structured provenance and comparison metadata.

Twenty additional warm Arguseye renders measured **p95 50 ms** against the 100 ms gate. Every sample is retained in the JSON result.

This run shows fewer tool calls and a shorter warm workflow, alongside larger default responses and a slower total cold path. It does not establish a general performance ranking. Cold means a fresh process/browser, with packages installed and OS caches potentially warm. Text-token estimates use characters/4, include text blocks and structured JSON, and exclude image tokens. No LLM reasoning, model billing, login journey, or full Next.js startup was measured. Summary-only output is available but was not used for these workflow measurements.

# Real components (MCP, as an agent calls it)

Run `node scripts/benchmark-real.mjs` after `npm run build` and installing the fixtures. Raw samples: `real-components.json`.

Nine real components from the libraries and frameworks people ship with, each rendered inside its real provider or router, through a fresh `arguseye mcp` process per project. Every row verified: no render errors, and the edit's text appeared in the next render.

## Result: 2026-11-01

linux x64; 12th Gen Intel(R) Core(TM) i5-1235U; 12 logical CPUs; Node v24.21.0. Re-run after the capture began fast-forwarding JavaScript animations and waiting out anything still moving.

| Component | First render | Warm p50 / p95 | Edit → pixels | Capture | Tokens (image + text) |
| --- | ---: | ---: | ---: | --- | ---: |
| MUI card (MUI 7 + Emotion, ThemeProvider) | 4,133 ms (cold) | 64 / 82 ms | 67 ms | 320×181 | ~78 + 42 |
| Mantine card (Mantine 8, MantineProvider) | 81 ms | 50 / 67 ms | 66 ms | 320×119 | ~51 + 39 |
| Chakra stat (Chakra 3, ChakraProvider) | 84 ms | 52 / 67 ms | 51 ms | 320×151 | ~65 + 40 |
| styled-components tag (themed) | 64 ms | 50 / 51 ms | 50 ms | 75×33 | ~4 + 25 |
| shadcn/Radix dialog, open (portal) | 105 ms | 67 / 73 ms | 85 ms | 1280×800 | ~1366 + 60 |
| React Router 7 nav (Link, hooks) | 676 ms (cold) | 50 / 54 ms | 52 ms | 1264×136 | ~230 + 61 |
| Svelte 5 badge (runes, scoped CSS) | 367 ms (cold) | 50 / 51 ms | 65 ms | 101×18 | ~3 + 26 |
| Vue 3 SFC card (script setup, scoped CSS) | 475 ms (cold) | 50 / 64 ms | 67 ms | 1280×154 | ~263 + 41 |
| Next.js hero (Tailwind v4, CSS module, next/image) | 756 ms (cold) | 53 / 68 ms | 67 ms | 1280×160 | ~274 + 38 |

- **Components that request animation frames pay one more frame.** MUI (ripple) and the Radix dialog (presence transitions) ask for frames after mounting, so the capture waits one fast-forwarded frame to catch an animation's end; the others are unchanged from the previous run.
- **Warm renders are about 50 ms** (64–67 ms for the two components above), and an edit on disk shows up in the next render in 50–85 ms, across MUI, Mantine, Chakra, styled-components, Radix, React Router, Svelte, Vue and Next.js.
- **Times step in 16.7 ms frames** (33, 50, 66 ms): a warm render is about three display frames (swap, settle, capture), not a fixed wait.
- **The first render in a project pays for bundling its packages once.** The libraries project (MUI + Emotion, Mantine, Chakra, styled-components, Radix) took 4–11 s cold across runs; the other projects were under 0.8 s. The bundle is cached on disk, so a later process starts warm.
- **An open dialog is the whole screen.** Radix renders it in a portal with a full-viewport overlay, so the capture is 1280×800 (~1,366 image tokens). Block-level components (a full-width nav, hero or card) are captured at their real width; fixed-width cards cost 50–80 image tokens.
- Not measured: LLM reasoning time, model billing, or a full app journey. Token counts are estimates (image: width × height / 750; text: characters / 4).
