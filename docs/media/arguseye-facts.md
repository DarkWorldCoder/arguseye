# Arguseye — product facts

Checked 30 October 2026. Use the spelling **Arguseye**.

## Short description

Arguseye renders React, browser-renderable Next.js and Vue components from project source so coding agents and developers can inspect UI edits without starting the app or writing stories.

## Longer description

Arguseye is an MIT-licensed local preview engine for coding agents and VS Code developers. It renders supported React, browser-renderable Next.js and Vue 3 components using a project’s own source, packages and styles. Agents can discover literal props from real usages, inspect screenshots and accessibility text, and compare edits against saved baselines. The VS Code extension previews unsaved edits through the same engine. Unresolved inputs, errors and missing context stay visible. Isolated previews support review alongside application tests.

## Release snapshot

- Maker: Ayush Niroula.
- License: MIT. Free and open source.
- npm engine, agent tools and CLI: `@ayushniroula/arguseye@0.0.7`.
- VS Code Marketplace: `ayushniroula.arguseye@0.0.6`.
- Frameworks: React, browser-renderable Next.js and Vue 3 SFCs.
- Headless prerequisites: Node.js 22+, installed project dependencies, Chromium or Google Chrome. Vue projects use their own matching runtime and compiler.

These version numbers are a dated snapshot; check the package registry and Marketplace before coverage.

## Coverage and limits

The engine runs locally and executes actual project code. That code can make its own network requests. Rendering returns screenshots, accessibility text, resolved inputs, warnings and errors. Baselines support before/after review using resolved props and viewport; they do not replay every interaction or application context.

Runtime-only props, arbitrary providers, authentication and backend states, Next.js server execution and Nuxt context can remain incomplete. A pixel difference is evidence for review, not automatic correctness. Isolated previews do not replace application-level testing. Performance depends on the project and workload; use the documented benchmark method rather than a universal speed claim.

## Installation

Run in the source project, then restart the chosen agent:

```sh
npx @ayushniroula/arguseye install claude
```

Replace `claude` with `codex`, `cursor` or another supported client. The VS Code visual panel is installed separately.

## Media notes

The 58-second launch film uses demo components rendered by Arguseye and illustrated workflow/editor scenes. The existing website gallery contains actual VS Code captures with source provenance. The share card in this kit is website marketing artwork with a decorative landscape and an isolated component preview. The logos are the existing project mark; no new application screenshots are included.

## Links

- Website: https://darkworldcoder.github.io/arguseye/
- Installation: https://darkworldcoder.github.io/arguseye/install.html
- Compatibility: https://darkworldcoder.github.io/arguseye/compatibility.html
- Benchmark method: https://darkworldcoder.github.io/arguseye/benchmarks.html
- Source: https://github.com/DarkWorldCoder/arguseye
- npm: https://www.npmjs.com/package/@ayushniroula/arguseye
- VS Code: https://marketplace.visualstudio.com/items?itemName=ayushniroula.arguseye
- Demo: https://www.youtube.com/watch?v=tOnDy-ySVnk
- Existing gallery: https://darkworldcoder.github.io/arguseye/gallery.html
- Film credits: https://darkworldcoder.github.io/arguseye/video/credits.md

## Contact

Ayush Niroula: ayushniroula08@gmail.com

Product issues: https://github.com/DarkWorldCoder/arguseye/issues
