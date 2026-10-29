# Arguseye — component previews beside your code

Preview React, browser-renderable Next.js, and Vue 3 components from your project without starting the app or writing stories. Inspect unsaved edits, choose real usage props, and compare a change against a saved baseline.

<p align="center"><img src="https://darkworldcoder.github.io/arguseye/assets/vscode-panel.png" alt="Actual VS Code screenshot showing component source beside the Arguseye preview, with export, usage, viewport, props and baseline controls" width="1000"></p>

## Start in VS Code

1. Install **Arguseye** using the button on this page.
2. Open your project and a `.tsx`, `.jsx`, or `.vue` component.
3. Run **Arguseye: Preview Component** from the Command Palette, use the eye icon in the editor title, or press `Ctrl+Alt+P` (`Cmd+Alt+P` on macOS).
4. Choose an export, usage, and viewport. Edit your component and inspect the preview beside it.

Your project's dependencies must be installed. Headless CLI and MCP use also require Node.js 22+ and Chromium or Google Chrome. [Installation and prerequisites](https://darkworldcoder.github.io/arguseye/guide.html#install).

## A preview that follows your work

- **Your source and packages.** Render with your project's React or Vue runtime, global styles, CSS modules, Tailwind, Sass, and assets.
- **Real usage inputs.** Select discovered call sites or adjust props in the panel. Runtime expressions and incomplete context stay visible.
- **Unsaved edits.** Preview the buffer as you work. Ordinary React refreshes and Vue template/style changes preserve component state; Vue script changes remount and report the reset.
- **Responsive checks.** Switch mobile, tablet, and desktop presets; fit the preview or inspect it at 1:1.
- **Before and after.** Capture a baseline, edit the source, and inspect changed pixels, dimensions, accessibility text, and new or resolved errors.

## Real component output

These screenshots show components rendered from a Next.js project using its own styles and packages.

<p align="center"><img src="https://darkworldcoder.github.io/arguseye/assets/example-home-section.png" alt="Real rendered home-page section with its project theme and six feature cards" width="480"> <img src="https://darkworldcoder.github.io/arguseye/assets/example-program-card.png" alt="Real rendered program card with its cover image, text and buttons" width="420"></p>

## Give your coding agent the same view

The MCP server and CLI use the same rendering engine as the extension. Run this from your project, then restart the chosen agent:

```bash
npx @ayushniroula/arguseye install claude
```

Replace `claude` with `codex`, `cursor`, `gemini`, `windsurf`, `vscode`, `copilot`, or `antigravity`. Use `print` for another MCP client.

Ask your agent:

> Render the component I changed, using its real usage props. Capture a baseline, compare after the edit, and show the screenshots, accessibility changes, errors, and incomplete context.

Five MCP tools connect the workflow: `render_component`, `list_usages`, `render_usages`, `describe_props`, and `render_diff`. Outputs include cropped PNGs and structured evidence. Use `output: "summary"` when you only need text.

## Know what the preview covers

These are isolated component renders using discovered inputs, not full-page integration tests. Missing runtime props, arbitrary provider values, authentication/backend states, Next.js server execution, and Nuxt application context may remain unsupported or incomplete. Successful pixels are not a correctness verdict; inspect warnings and use application tests for full journeys.

Performance varies with the project. The [recorded benchmark](https://darkworldcoder.github.io/arguseye/guide.html#benchmarks) separates small-fixture warm renders from larger real-project observations, and includes the machine, method, raw samples, cold costs, and response sizes.

[Explore the product and interactive examples](https://darkworldcoder.github.io/arguseye/) · [Installation](https://darkworldcoder.github.io/arguseye/guide.html#install) · [Compatibility](https://darkworldcoder.github.io/arguseye/guide.html#compatibility) · [Security](https://darkworldcoder.github.io/arguseye/guide.html#security)

MIT licensed. Made by [Ayush Niroula](https://ayushniroula.com.np).
