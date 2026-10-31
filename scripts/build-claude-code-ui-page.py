"""Builds docs/claude-code-ui.html: a setup guide for letting Claude Code (and other MCP agents) see the UI they change.
Styles come from docs/compare.html so the page matches the site. Facts come from src/install.ts, src/agent/mcpServer.ts
and a real `arguseye shot --capture-dir` + `arguseye diff` run on film/demo-app/components/BoardingPass.tsx."""
import json, os, re
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
style = re.search(r"<style>(.*?)</style>", open(os.path.join(here, "compare.html")).read(), re.S).group(1)
style += "figure{margin:24px 0}figcaption{font-size:14px;color:var(--muted)}.trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.trio img{border:1px solid var(--line);border-radius:10px;background:#fff}@media(max-width:700px){.trio{grid-template-columns:1fr}}td:first-child code{white-space:nowrap}"

URL = "https://darkworldcoder.github.io/arguseye/claude-code-ui.html"
TITLE = "Let Claude Code see the UI it changes, without a dev server"
DESC = ("Set up Arguseye so Claude Code, Codex, Cursor or another MCP agent can render a React, Next.js or Vue component "
        "from source, check it after an edit with a pixel diff, and render it at every place it is used.")
FAQ = [
    ("How do I let Claude Code see my UI?",
     "Run npx @ayushniroula/arguseye install claude in the project, then restart Claude Code. It adds an arguseye entry to the project's .mcp.json and a skill to ~/.claude/skills/arguseye. Claude can then call render_component to get a cropped screenshot and the accessibility tree of any React, Next.js or Vue component."),
    ("Does it need the dev server running?",
     "No. Arguseye renders the component from its source with the project's installed packages, layouts and global CSS. Node.js 22 or newer, installed dependencies and Chromium or Google Chrome are required."),
    ("How does Claude check its own edit?",
     "It renders the component first, which returns a captureId, makes the edit, then calls render_diff with that id. The result is the before and after images, a diff image with the changed pixels marked, the share of pixels that changed and whether the accessibility tree changed."),
    ("Which other agents work?",
     "Any MCP client. The install command also writes config for codex, cursor, gemini, windsurf, vscode, copilot and antigravity; print shows the snippet for anything else."),
]
ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}

CLIENTS = [
    ("claude", "Claude Code", ".mcp.json in the project", "~/.claude/skills/arguseye"),
    ("codex", "Codex", "~/.codex/config.toml", "~/.agents/skills/arguseye"),
    ("cursor", "Cursor", "~/.cursor/mcp.json", ".cursor/skills/arguseye"),
    ("gemini", "Gemini CLI", ".gemini/settings.json", ".gemini/skills/arguseye"),
    ("copilot", "GitHub Copilot", ".vscode/mcp.json", ".github/skills/arguseye"),
    ("vscode", "VS Code agent mode", ".vscode/mcp.json", "none"),
    ("windsurf", "Windsurf", "~/.codeium/windsurf/mcp_config.json", "none"),
    ("antigravity", "Antigravity", ".agents/mcp_config.json", ".agents/skills/arguseye"),
]
TOOLS = [
    ("render_component", "A PNG cropped to the component and its accessibility tree. Pass <code>usage</code> to use a real call site's props, <code>props</code> as JSON, or neither for samples from the TypeScript type. Also takes a viewport, a stand-in parent frame, clicks and typing before capture, and seeded localStorage."),
    ("render_diff", "Compares the current source with an earlier <code>captureId</code>, reusing its props and viewport: before, after, a diff image, the changed-pixel share and whether the accessibility tree changed."),
    ("list_usages", "Every place the component is used, with the literal props each call site passes and the ones that depend on runtime values."),
    ("render_usages", "Renders the component at every call site with that site's props, in batches."),
    ("describe_props", "The props the component accepts, read from its TypeScript type, with the sample values render_component uses when none are given."),
]

nav = '<nav aria-label="Documentation"><a href="index.html">Product</a><a href="install.html">Installation</a><a href="compatibility.html">Compatibility</a><a href="benchmarks.html">Benchmarks</a><a href="compare.html">Compare</a><a href="claude-code-ui.html" aria-current="page">Claude Code setup</a><a href="guide.html">Complete guide</a></nav>'
head = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{TITLE} | Arguseye</title>'
        f'<meta name="description" content="{DESC}"><link rel="canonical" href="{URL}"><meta property="og:type" content="article"><meta property="og:title" content="{TITLE}">'
        f'<meta property="og:description" content="{DESC}"><meta property="og:url" content="{URL}"><meta property="og:image" content="https://darkworldcoder.github.io/arguseye/assets/og-hero.png">'
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">'
        f'<meta name="twitter:title" content="{TITLE}"><meta name="twitter:description" content="{DESC}"><meta name="twitter:image" content="https://darkworldcoder.github.io/arguseye/assets/og-hero.png">'
        f'<link rel="icon" href="assets/icon.svg"><style>{style}</style><script type="application/ld+json">{json.dumps(ld)}</script></head>')
body = [f'<body><header><a href="index.html" style="display:inline-flex;align-items:center;gap:9px"><img src="assets/icon.svg" width="24" height="24" alt="">Arguseye</a>{nav}<h1>Let Claude Code see the UI it changes</h1>'
        '<p>Claude Code edits React, Next.js and Vue components without seeing them. Arguseye is an MCP server that renders a component from your source, inside your layouts and global CSS, and gives the agent a cropped screenshot, the accessibility tree and errors with file paths. After an edit it compares the new render with the old one. Setup is one command, and nothing else has to be running: no dev server, no login, no stories.</p></header><main>']
body.append('<section aria-labelledby="install"><h2 id="install">1. Install in one command</h2><p>In the project root:</p><pre><code>npx @ayushniroula/arguseye install claude</code></pre>'
            '<p>This adds an <code>arguseye</code> server to the project\'s <code>.mcp.json</code> (other servers in the file are kept) and copies the skill that tells Claude when to use it to <code>~/.claude/skills/arguseye/SKILL.md</code>. Add <code>--dry-run</code> to see the files without writing them. Restart Claude Code so it loads the new server.</p>'
            '<p>Requirements: Node.js 22 or newer, the project\'s dependencies installed, and Chromium or Google Chrome.</p></section>')
body.append('<section aria-labelledby="ask"><h2 id="ask">2. Ask Claude to look</h2><p>The skill makes Claude reach for the tools on its own after UI edits, and you can also ask directly:</p>'
            '<blockquote>Render components/BoardingPass.tsx at 390 px wide and tell me if any text is clipped.</blockquote>'
            '<blockquote>Make the gate number bigger, then compare against the render from before your change.</blockquote>'
            '<blockquote>Render BoardingPass at every place it is used.</blockquote>'
            '<table><thead><tr><th>Tool</th><th>What Claude gets back</th></tr></thead><tbody>'
            + "".join(f'<tr><td><code>{n}</code></td><td>{d}</td></tr>' for n, d in TOOLS) + '</tbody></table></section>')
body.append('<section aria-labelledby="check"><h2 id="check">3. What a check looks like</h2>'
            '<p>A real run on the demo app in this repository. The baseline is a boarding pass rendered with the props from its call site. The edit makes the gate, seat and boarding values bigger (<code>text-lg</code> to <code>text-3xl</code>). The diff reports <strong>3.83% changed pixels</strong> and marks two areas: the bigger values, which were asked for, and the tear line and barcode, which moved down 8 px because the card grew from 338 to 346 px.</p>'
            '<figure><div class="trio"><img src="assets/guide/boardingpass-before.png" width="340" height="338" alt="Boarding pass before the edit, gate B12, seat 14A, boarding 09:35 in small dark text">'
            '<img src="assets/guide/boardingpass-after.png" width="340" height="346" alt="Boarding pass after the edit, the same values larger and in indigo">'
            '<img src="assets/guide/boardingpass-diff.png" width="340" height="346" alt="Pixel diff with the values, the tear line and the barcode marked in pink"></div>'
            '<figcaption>Before, after and the pixel diff, exactly as the tool returned them. The same check runs from a terminal with <code>arguseye shot FILE --capture-dir DIR</code> and <code>arguseye diff --baseline DIR --out DIR</code>.</figcaption></figure></section>')
body.append('<section aria-labelledby="agents"><h2 id="agents">Codex, Cursor and other agents</h2><p>Replace <code>claude</code> with the client name. The command merges into existing config files.</p>'
            '<table><thead><tr><th>Name</th><th>Agent</th><th>MCP config</th><th>Skill</th></tr></thead><tbody>'
            + "".join(f'<tr><td><code>{c}</code></td><td>{n}</td><td><code>{m}</code></td><td>{"none" if s == "none" else f"<code>{s}</code>"}</td></tr>' for c, n, m, s in CLIENTS)
            + '</tbody></table><p><code>print</code> writes the MCP snippet to the terminal for any other client, and <code>all</code> sets up every client above at once.</p></section>')
body.append('<section aria-labelledby="limits"><h2 id="limits">Where it stops</h2><p>These are isolated component renders with discovered inputs, not full application tests. Runtime-only props, arbitrary providers, backend and auth states, Next.js server execution and Nuxt application context may be incomplete, and the render says so with warnings. A pixel diff is evidence for review, not proof the change is right. The <a href="compatibility.html">compatibility page</a> has the details, and the <a href="compare.html">comparison</a> covers when Storybook or a browser MCP is the better tool.</p></section>')
body.append('<section aria-labelledby="faq"><h2 id="faq">Questions</h2>' + "".join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in FAQ) + '</section>')
body.append('<p class="back"><a href="guide.html#contents">Back to contents ↑</a></p></main><footer><a href="index.html">Arguseye</a> · <a href="https://github.com/DarkWorldCoder/arguseye">GitHub</a> · <a href="https://www.npmjs.com/package/@ayushniroula/arguseye">npm</a> · <a href="https://marketplace.visualstudio.com/items?itemName=ayushniroula.arguseye">VS Code</a> · <a href="guide.html#license">MIT licensed</a></footer></body></html>')
open(os.path.join(here, "claude-code-ui.html"), "w").write(head + "".join(body) + "\n")
print("wrote claude-code-ui.html")
