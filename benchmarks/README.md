# Measured component-edit workflow

Run `npm run benchmark` after installing the root and React fixture dependencies. The script copies the installed fixture into temporary projects and uses real stdio MCP clients. Source edits never touch the fixture itself. Raw results are in `latest.json`.

The task is to capture `ProductCard` with title `Desk` and price `3`, edit its button label, and inspect the rendered result. Playwright receives a minimal Vite app with a known URL and no login. Component Preview renders the source directly and also returns an automated pixel/semantic comparison.

## Result: 2026-10-27

Linux x64; Intel Core i5-1235U; 12 logical CPUs; Node v24.21.0. All four workflows verified the expected result.

| Workflow | Tool calls | Startup | Workflow | Total | Response bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Component Preview, cold | 2 | 1,172 ms | 933 ms | 2,105 ms | 49,076 |
| Playwright MCP + Vite, cold | 6 | 576 ms | 1,128 ms | 1,704 ms | 28,006 |
| Component Preview, warm | 2 | 0 ms | 145 ms | 145 ms | 48,669 |
| Playwright MCP + Vite, warm | 4 | 0 ms | 217 ms | 217 ms | 27,298 |

Component Preview returned four images across the two calls: initial capture, before, after, and highlighted changes. Playwright returned two component screenshots. The response sizes therefore compare different evidence bundles. Both workflows included accessibility text; Component Preview also included structured provenance and comparison metadata.

Twenty additional warm Component Preview renders measured **p95 50 ms** against the 100 ms gate. Every sample is retained in the JSON result.

This run shows fewer tool calls and a shorter warm workflow, alongside larger default responses and a slower total cold path. It does not establish a general performance ranking. Cold means a fresh process/browser, with packages installed and OS caches potentially warm. Text-token estimates use characters/4, include text blocks and structured JSON, and exclude image tokens. No LLM reasoning, model billing, login journey, or full Next.js startup was measured. Summary-only output is available but was not used for these workflow measurements.
