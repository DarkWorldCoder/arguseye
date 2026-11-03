# Native template previews

Implementation on `feat/template-previews`; this does not change the published 0.0.15 packages. Native template adapters require native compilation mode; Vite compatibility mode does not implement this bridge. Templates use the project's real engine and interpreter, then the existing Chromium renderer, screenshot, accessibility snapshot and baseline comparison. No application server or story is required. A browser preview does not reproduce an email client's rendering.

## Choose an engine and supply data

From your project, with its dependencies installed:

```sh
arguseye shot templates/card.html --root . --engine django --props '{"name":"Ada"}' --json
arguseye shot views/card.hbs --root . --profile example --capture-dir /tmp/card-baseline --json
arguseye diff --baseline /tmp/card-baseline --out /tmp/card-comparison --root . --json
```

MCP `render_component` accepts `engine`, `profile`, and the existing `props` object as template context. `render_diff` reuses the baseline's engine, resolved context and viewport. It does not silently load changed profile data into an existing baseline. An engine/runtime-version change makes the comparison incomplete.

In VS Code, right-click a supported template in the editor, editor tab or Explorer and select **Arguseye: Preview Component**. The clicked file is used even if another editor is active. The existing title action and `Ctrl+Alt+P` / `Cmd+Alt+P` remain available. Choose an engine for HTML/TPL, a data profile, and **Props** to edit a JSON context object. Unsaved layouts and partials update the preview. Each template document update resets interactive DOM state; the panel reports that policy. Templates containing JavaScript use a fresh browser document for verification and reload on live updates, so initialization scripts run again. Script-free templates keep the browser page warm. Script-bearing document startup costs are separate from the script-free warm-render gate. Baseline and comparison use the same engine as MCP and CLI. Workspace Trust is required.

## Project configuration

Add an optional `arguseye.templates.json` at the native project root:

```json
{
  "version": 1,
  "mappings": [{"pattern": "templates/**/*.html", "engine": "django"}],
  "roots": ["templates"],
  "static": {"/static/": "static"},
  "runtimes": {"python": ".venv/bin/python"},
  "profiles": {"example": {"name": "Ada", "items": ["Tea", "Coffee"]}},
  "options": {"jinja2": {"autoescape": true}},
  "setup": {"django": "preview_setup.py"},
  "limits": {"timeoutMs": 20000}
}
```

Paths are relative to the selected project root. Python automatically uses `.venv/bin/python` or `.venv/Scripts/python.exe` when present; otherwise it uses the host's Python. PHP uses the project's `vendor/autoload.php`; Ruby uses its `Gemfile` through Bundler. Configure another executable when the project uses a different environment. Node engines resolve from the project's own packages. Arguseye neither installs runtimes into user projects nor substitutes another engine with similar syntax. A Python/PHP/Ruby project does not need `package.json`, React or Vue.

Profiles can also name a JSON file, for example `"example": "preview-data/example.json"`. Explicit props override profile keys. `.html` stays ordinary HTML unless mapped or explicitly selected; `.tpl` requires a selection. Ruby Liquid and LiquidJS remain separate identities. When both are declared, choose explicitly. Compound suffixes such as `.blade.php` and `.html.twig` take priority over general suffixes.

`doctor --json` / `inspect_project` statically report configuration, declared engines, profiles and Node package availability without executing setup or application startup. Interpreter/engine versions are verified during rendering and returned in `template` evidence. A static declaration alone is not runtime certification.

## Built-in adapters and limits

Installed fixtures exercise these engine families on the development machine; cross-platform CI is configured separately and must pass before release.

| Runtime | Engines and fixture versions | Scope |
| --- | --- | --- |
| Node | Handlebars 4.7, Mustache 4.2, EJS 3.1, Pug 3.0, Nunjucks 3.2, LiquidJS 10.21, Eta 3.5, doT 1.1 | Native rendering; native partials/includes where provided by the engine; unsaved source overlays |
| Python | Django 5.2, Jinja2 3.1, Mako 1.4, Tornado 6.6 | Standalone engine context; actual inheritance/includes; no automatic views, middleware or database context |
| PHP | Twig 3.30, Illuminate View/Blade 12.70, Smarty 5.8, Latte 3.1, PHP 8.3 views | Composer engines and standalone Blade factory; no automatic Laravel application/services. PHP views execute trusted PHP; arbitrary `include`/`require` code is outside overlay-loader guarantees |
| Ruby | ERB with Ruby 3.2, Haml 7.5, Slim 5.2, Liquid 5.14 | Standalone native templates; Liquid partials; no Rails controllers, view helper reconstruction, implicit Rails layouts or partial helpers |

Defaults follow the engine: ERB/PHP/Mako/Jinja do not all escape by default. Configure Jinja HTML autoescaping explicitly; use each engine's escaping syntax. Missing context is traced for Django/Jinja and supported Node lookups without changing the rendered missing-value behavior. Eta, Mako, Tornado, PHP and Ruby currently return an explicit lookup-tracing warning, so their evidence is incomplete until reviewed. Native errors retain stack and template paths/lines where the engine provides them.

Setup is explicit executable project code. Python setup exports `setup(engine)` returning dictionaries such as Django `libraries`/`builtins` or Jinja `filters`/`globals`/`extensions`. Node setup exports a default function returning `helpers`, `filters`, `globals` and/or native Handlebars `partials`. Existing partial aliases can also map names to real files in `options.handlebars.partials`, for example `{"branded-email":"templates/_branded-email.hbs"}`. Aliases are explicit project context; underscore conventions are not guessed. PHP setup returns a callable/array with Twig `extensions`, `filters`, `globals`, Latte `filters`, or Blade `configure(factory, compiler)`. Ruby setup evaluates to a callable/hash with scope `modules` or Liquid `filters`. Each render recreates explicit setup processes to isolate helper state. Unsaved Node setup uses native module hooks and requires Node 22.15+; older Node versions must save helper edits or upgrade. Node/Python setup imports honor unsaved project modules. PHP setup entry edits work, while arbitrary PHP `require` dependencies must be saved; PHP views and setup imports are trusted code outside the template-loader overlay guarantee. Helpers needing routes, auth, translations or backend data must be supplied by the project; they are not invented.

Template source, configuration, profile and actual loaded dependency reads contribute to source provenance. Built-in template loaders enforce canonical allowed roots and use unsaved buffers. A source hash mismatch during rendering is reported as incomplete. Static asset mappings enforce their own mapped root. This is **trusted local code execution**, not an OS sandbox: project helpers, runtime imports and arbitrary PHP/Ruby/JavaScript/Python code can read files or use the network. Do not render untrusted projects.

## Fonts and capture fidelity

Templates use their own CSS font stacks and `@font-face` files. Project `public/` assets and configured static mappings are served by the preview. Captures wait up to one second for fonts and image decoding; a loading or failed font face is named in asset warnings, including a corrupt font returned with a successful HTTP response. Such captures and comparisons remain incomplete. A fallback font is not proof that the requested face loaded. Install the project's font assets or correct its URLs rather than substituting an unrelated font. Remote fonts still depend on network access, CORS and the original license.

The installed Handlebars fixture includes licensed DejaVu Sans Mono and verifies its browser-loaded status. Separate cases check missing and corrupt font warnings. This establishes that local font loading and failure reporting work; it does not certify every external font host or unavailable system font.

## Other native engines: adapter protocol

Do not substitute Nunjucks for Jinja, JavaScript Liquid for Ruby Liquid, or browser placeholders for compiled server engines. For a JVM, .NET, Go, Elixir, Rust or another runtime, configure its own harness:

```json
{
  "version": 1,
  "adapters": {
    "my-native-engine": {
      "command": ["/absolute/path/to/project-preview-harness", "${root}"],
      "suffixes": [".mytemplate"]
    }
  },
  "mappings": [{"pattern": "views/**/*.mytemplate", "engine": "my-native-engine"}]
}
```

For VS Code custom harnesses, map a `.tpl` file; arbitrary custom suffixes currently use CLI/MCP. The command starts in the project directory with no shell. It reads one UTF-8 JSON object per stdin line and writes one JSON reply per stdout line. Send logs to stderr. Requests include `v:1`, unique `id`, `type:"render"`, `root`, absolute `file`, canonical `roots`, ordered `dirs`, `props`, `options`, optional `setup`, and absolute-path `overlays`. The harness must use its real native engine, honor source overlays and bounded loader roots, and report actual dependencies, errors and unresolved context.

A reply contains `v:1`, matching `id`, `html:string`, `dependencies:string[]` (absolute files), `errors:string[]`, `warnings:string[]`, `unresolved:string[]`, `engineVersion`, `runtimeVersion`, and `sources:{absolutePath:sha256OfUtf8Source}`. Omitting source hashes emits a consistency warning. Incorrect IDs, malformed replies and crashes terminate the worker; later requests can restart it. A missing executable or package returns an actionable render error.

Each session has at most four workers, 32 queued requests per engine, a 20-second maximum render deadline (configurable downward), an 8 MiB request/reply bound, and a 1 MiB built-in source-file bound. Workers expire after idle time and recycle after bounded use; compilation caches have bounded entry counts. Cancellation kills an active worker. Custom adapters are trusted native programs and must provide their own internal loader/cache limits. This bridge does **not** certify Thymeleaf, Razor, HEEx or every other engine: each requires a real harness and installed conformance fixtures.

## Validation

`node scripts/installFixtures.mjs` installs the fixture-local npm, Python, Composer and Bundler environments. Install those development tools first; the product itself does not install them. Tests live at the existing HTTP, headless render and VS Code integration seams. The Handlebars fixture checks native template warm-render timing using p95 over 20 renders with the same 100 ms limit; cold interpreter/setup costs remain separate. See `docs/conformance.md` for the separate 50 ms physical edit-to-pixels target and platform evidence boundaries.
