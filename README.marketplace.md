# Arguseye — component previews beside your code

Preview React, browser-renderable Next.js, Vue 3, and Svelte components (including React Router and Remix browser components) from your project without starting the app or writing stories. Inspect unsaved edits, choose real usage props, and compare a change against a saved baseline.

<p align="center"><img src="https://darkworldcoder.github.io/arguseye/assets/vscode-panel.png" alt="Actual VS Code screenshot showing component source beside the Arguseye preview, with export, usage, viewport, props and baseline controls" width="1000"></p>

## Start in VS Code

1. Install **Arguseye** using the button on this page.
2. Open your project and a `.tsx`, `.jsx`, `.vue`, or `.svelte` component.
3. Run **Arguseye: Preview Component** from the Command Palette, use the eye icon in the editor title, or press `Ctrl+Alt+P` (`Cmd+Alt+P` on macOS).
4. Choose an export, usage, and viewport. Edit your component and inspect the preview beside it.

Your project's dependencies must be installed. Headless CLI and MCP use also require Node.js 22+ and Chromium or Google Chrome. [Installation and prerequisites](https://darkworldcoder.github.io/arguseye/guide.html#install).

Release builds target **Windows x64, macOS Apple Silicon, and Linux x64**. Screenshots below were captured in a real VS Code extension host on Linux; Windows and macOS builds are packaged separately. Images use public HTTPS URLs and load independently of your operating system.

## A preview that follows your work

- **Your source and packages.** Render with your project's React, Vue, or Svelte runtime, global styles, CSS modules, Tailwind, Sass, and assets.
- **Real usage inputs.** Select discovered call sites or adjust props in the panel. Runtime expressions and incomplete context stay visible.
- **Unsaved edits.** Preview the buffer as you work. Ordinary React refreshes and Vue template/style changes preserve component state; Vue script changes and Svelte edits remount and report the reset.
- **Responsive checks.** Switch mobile, tablet, and desktop presets; fit the preview or inspect it at 1:1.
- **Theme checks.** Choose light or dark; baseline comparisons replay the captured theme.
- **Dialogs and canvases.** Captures include visible portaled UI and canvas pixels. Canvas content is reported separately from accessibility text; canvas settling can take longer than a simple component render.
- **Before and after.** Capture a baseline, edit the source, and inspect changed pixels, dimensions, accessibility text, and new or resolved errors.

## Real VS Code screenshots

These captures use existing WiseAdmit and CSCA.ai production source files, their installed packages, and their own styles and assets. The source editor and Arguseye panel are both visible. They are isolated component previews.

### A responsive page section

WiseAdmit's `AIEcosystem.tsx` at desktop and mobile widths. The mobile preview uses the component's existing accordion layout.

![WiseAdmit AIEcosystem source beside its desktop component preview in the real VS Code extension](https://darkworldcoder.github.io/arguseye/assets/vscode-desktop.png)

![The same WiseAdmit component rendered at the mobile viewport in VS Code](https://darkworldcoder.github.io/arguseye/assets/vscode-mobile.png)

### Inspect an unsaved change

Capture a baseline, edit the heading without saving, then choose **Compare Changes**. The panel shows before, after, changed pixels, and context warnings. This example reports incomplete evidence because its Next.js provider uses unsupported server/font behavior; the warning remains visible.

![An unsaved heading edit in WiseAdmit with before, after, changed pixels, and the incomplete-context warning in VS Code](https://darkworldcoder.github.io/arguseye/assets/vscode-compare.png)

### More components from CSCA.ai

The existing `HeroSection.tsx`, `CscaProvide.tsx`, and `ExamEssentials.tsx` from CSCA.ai's `cscanew/csca` codebase. Their Next font variables use the project's cached Nunito and Manrope font faces. If matching cached Next font assets are unavailable, font context remains explicitly unresolved.

![CSCA.ai HeroSection production source beside its real panda illustration, typography, and call to action in VS Code](https://darkworldcoder.github.io/arguseye/assets/vscode-csca-hero-desktop.png)

![CSCA.ai production practice and learning feature cards with their existing imagery rendered beside CscaProvide source in VS Code](https://darkworldcoder.github.io/arguseye/assets/vscode-csca-features-desktop.png)

![CSCA.ai ExamEssentials production source and its exam-information card grid in the VS Code preview](https://darkworldcoder.github.io/arguseye/assets/vscode-csca-exam-desktop.png)

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
