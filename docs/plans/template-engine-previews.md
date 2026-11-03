# Native template previews and VS Code right-click preview

Status: implemented locally on `feat/template-previews`, 2026-11-03. Installed Node/Python/PHP/Ruby adapter fixtures, real HYVE Handlebars templates and the extracted Linux VS Code template scenario have been exercised. Full-suite, exact-package and cross-platform release gates are recorded separately; this is not a released version. See [implementation scope](../templates.md). Existing published release: 0.0.15.

## Outcome

Open an existing component or template, choose **Preview Component**, supply its preview data, and inspect the rendered HTML, screenshot and comparison without starting the application server. Provide that command from the editor, editor tab and file Explorer context menus, alongside the existing title action and keyboard shortcut.

Support native template engines across languages, including Django. An engine with similar syntax is not a replacement for the project's actual engine. “All engines” means an extensible adapter system and an explicit tested support matrix; an unknown engine must not be advertised as supported merely because its extension is recognized.

## Baseline gaps identified before implementation

- `package.json` contributes only `editor/title`; it has no `editor/context`, `editor/title/context` or `explorer/context` entry.
- `src/extension/extension.ts` ignores command arguments and always uses `activeTextEditor`. Its previewable-file filter omits templates and plain-script widgets.
- Framework selection, export selection, source discovery, audit discovery and server transforms each contain their own extension checks. Adding only a menu or one `.hbs` check would leave the other entry points inconsistent.
- The HTML adapter already handles actual HTML, stylesheet/script loading and Chromium mounting. Reuse it after native template rendering; do not convert templates into JSX.
- The existing source reader, file-access checks, update messages, capture store and comparison contracts must remain shared across editor, CLI and MCP.

## Support scope and delivery order

This was the staged implementation scope. The current installed-fixture matrix and exact adapter limits are in [the template guide](../templates.md). Engine versions outside those fixtures and additional runtime hosts still need conformance evidence.

| Stage | Runtime | Engines |
| --- | --- | --- |
| First native adapters | Python | Django templates and Jinja2 |
| First native adapters | Node.js | Handlebars, Mustache, EJS, Pug, Nunjucks, LiquidJS |
| Next adapters | PHP | Twig, Laravel Blade, Smarty, Latte and ordinary PHP views |
| Next adapters | Ruby | ERB, Haml, Slim and native Ruby Liquid |
| Further adapters through the same protocol | Python / Node.js | Mako, Tornado templates, Eta, Edge, doT and other installed engines |
| Further native runtime hosts | JVM / .NET / Go / Elixir / Rust | Thymeleaf, FreeMarker, Velocity; Razor and Scriban; Go HTML templates; EEx/HEEx; Tera and Askama |

Compiled or framework-dependent engines need a native render harness and separate cold-build evidence. JSP, full ASP.NET request behavior, Rails controllers and Phoenix LiveView server interactions cannot be certified by a standalone HTML capture. Document the exact supported rendering subset rather than substituting fake server APIs.

Consolidate is useful prior art for Node adapter conventions and package discovery, not a universal runtime or a replacement for Python Django, PHP Twig or Ruby Liquid. Its engine list includes deprecated/unmaintained implementations. Do not automatically install that list or claim every adapter can honor unsaved buffers and bounded includes.

## 1. Centralize target capabilities and fix VS Code invocation

- Add a shared target registry describing exact suffixes, engine candidates, runtime requirements and available capabilities. Match compound suffixes such as `.blade.php`, `.html.twig` and `.html.heex` before generic `.php` or `.html`.
- Generate the extension's static menu/language contributions from a checked-in capability inventory during development/build. Use the same inventory for command validation, discovery, exports, audit and live updates.
- Add **Preview Component** to editor, editor-tab and Explorer context menus. Keep `Ctrl+Alt+P` / `Cmd+Alt+P` and the existing command ID.
- Accept a `vscode.Uri` argument. Preview the clicked resource even when a different editor is active; open a text document without unnecessarily switching editors. Use the active editor only when no URI was passed.
- Preview only the clicked file in a multi-selection. Hide actions on folders and unsupported resources; handle deleted files, non-file URIs and non-component modules with actionable messages. Remote workspaces must use the extension-host filesystem/runtime rather than the desktop browser's machine.
- Show template actions for known template formats even when their runtime is absent, so invoking one can explain what is missing. Do not show Preview on every text file.

## 2. Add a shared template adapter contract

- Introduce a template renderer behind the existing preview server and HTML mounting path. A template request supplies the same `file`, `props`, viewport, fixtures and capture options; `props` are its template context. Add an optional explicit engine selector across MCP, CLI and the editor for ambiguous files.
- An adapter reports its engine/runtime versions, prepares its real environment, renders HTML, records dependencies and diagnostics, invalidates changed inputs and disposes resources. A versioned JSON-lines protocol carries these operations to non-Node runtimes.
- Use persistent workers per project/runtime for warm rendering and compiled-template caching. Terminate hung workers on cancellation/deadline; restart after a crash. Reject stale replies from older edits. Bound output sizes, queue depth and retained cache memory.
- Give each request fresh context/helper state while reusing safe compilation caches. Never let one request's globals, filters, data or environment changes leak into another.
- Keep plain HTML and existing framework rendering on their current path. Do not start template workers or add template-specific filesystem scans to ordinary warm React/Vue/Svelte renders.

## 3. Resolve the actual project environment

- Resolve Node engines from project packages through the existing resolver. Select Python from the configured project environment, PHP from the configured PHP/Composer environment, and Ruby from the project's bundle. Never silently fall back to an Arguseye-owned engine or install global runtimes.
- Add a versioned `arguseye.templates.json` for engine/path mappings, template/static roots, runtime selection and named preview-data profiles. Read it statically during inspection. Keep executable helper/filter/setup registration in an explicit project setup entry, loaded only during rendering.
- For `.html`, `.tpl` and similar ambiguous suffixes, prefer explicit path mappings, then confident project evidence; otherwise ask for an engine in the editor or return actionable choices to an agent. Never guess Django solely from `{% ... %}` syntax.
- Extend `inspect_project` and `doctor` with template capabilities, selected runtime/package versions and missing setup diagnostics. Python/PHP/Ruby-only projects must not require `package.json`, React, npm packages or Node-style root discovery. Static inspection must not execute application startup.
- Replay the selected engine, data profile and explicit context in baselines. Include template/config/helper/layout/partial sources and runtime identity in provenance. Report an incompatible engine/runtime change explicitly when comparing an older baseline.

## 4. Implement native semantics and dependency-aware live edits

- Django: use the installed Django `Engine`, real template directories, inheritance, includes, registered tags, filters and escaping. Support standalone rendering first, plus explicitly configured project settings/bootstrap when needed. Do not automatically run views, middleware or database queries to invent context.
- Jinja2: use the project's `Environment`, extensions, filters, globals and native loader semantics. Do not render it with Nunjucks. Handle async rendering only where the configured engine supports it.
- Other adapters must preserve their own escaping, block/layout/include resolution and error behavior. Framework helpers such as routes, translations, static assets or authentication require actual configured context or an explicit missing-context diagnostic.
- Route built-in template-loader reads through canonical file boundaries and the unsaved-buffer overlay, including inherited layouts and partials. Retain dependency edges even when compilation fails, so fixing a parent or partial refreshes the affected preview.
- Dynamic includes and partial names resolve using the supplied data where possible. Record actual resolved files; mark unresolved dependencies/context explicitly. Detect recursive include cycles and enforce bounded rendering.
- A change recompiles only affected template dependencies. Rendering a new template document resets its interactive DOM state; report that reset instead of promising React-style refresh preservation.
- Preserve ordinary project asset URLs and mapped static roots. Reuse Chromium's existing font/image settling and reduced-motion policy. Email templates are browser HTML previews; this does not certify Outlook/Gmail rendering.

## 5. Make template previews useful to humans and agents

- Provide an engine selector where ambiguous, a named data-profile selector and a JSON context editor in the existing panel. Keep viewport, theme, baseline and comparison controls.
- Allow explicit data without creating a story. Keep preview-data files optional; do not modify source templates to insert sample content.
- Record supplied versus sampled context and unresolved lookups where the engine can identify them. Preserve the engine's default missing-value semantics in the pixels. When lookup tracing is unavailable, report that limitation rather than asserting complete context.
- Return the existing PNG, accessibility snapshot, warnings, `errors: string[]`, timing, source revision and capture ID. Add template metadata without breaking existing MCP schemas. Native errors retain the real template/partial path and line where available.
- Template syntax and render failures belong in render evidence; invalid engine IDs or incompatible inputs get actionable input errors. A missing runtime must leave inspection available.
- Extend template reference discovery only where the engine/parser proves the include or call-site relationship. Dynamic context remains unresolved, not silently replaced with guessed integration data.

## 6. Trust and runtime boundaries

Honor VS Code Workspace Trust before executing local template/setup code. Built-in file loaders enforce selected roots and canonical symlink checks. Native template execution, helpers and framework bootstrap are trusted project code: worker isolation provides lifecycle/deadline control, not an operating-system security sandbox. Do not claim that custom Python/PHP/Ruby/Node code cannot read files or make requests. Do not weaken existing preview HTTP host/origin boundaries or expose workers on a network port.

## 7. Validation and commits

Follow red → green with one passing slice per commit, using only the existing approved seams.

1. **VS Code integration:** add context-menu contributions and URI-aware command handling. In the existing integration suite, invoke the command with a different clicked file URI and prove the correct target mounts; verify supported menu contributions and keyboard behavior there.
2. **Preview HTTP/headless:** add the shared adapter path with installed Django/Jinja fixtures, then Node fixtures. Assert literal known output, escaping, includes/inheritance, CSS/assets and engine identity.
3. **Update events/headless:** verify unsaved template/parent/partial/context edits, invalidation, state-reset reporting, source fingerprints and baseline replay. Extend the second VS Code scenario to an unsaved template edit.
4. **Failure contracts:** missing context/runtime/helper, syntax errors with source locations, ambiguous `.html`, unsupported engine/version, cycles, symlinks/traversal, worker timeout/crash/cancellation, stale replies and concurrent requests with different data.
5. **Diff contracts:** unchanged output, text/style/size changes, new/resolved errors and warnings, incomplete evidence and expired capture IDs.
6. **Native runtime expansion:** add installed PHP/Ruby fixtures and then each further runtime host. No engine enters the supported matrix without executable render, include/layout, update and error coverage.
7. **Performance/package release:** retain warm p95 ≤100 ms over 20 renders and the strict live-DOM timing limit. Measure cold interpreter/compile/setup costs separately and retain the 50 ms physical edit-to-pixels target as a separate benchmark. Unsupported performance tiers must be explicit, not hidden by raised limits or fastest-run selection.

Run tests and type checking for each implementation slice. Before release, test the npm archive and extracted native VSIX outside the checkout, including packaged worker/helper files and at least one non-Node project. Validate native Linux/Windows/macOS behavior where the claimed runtime is installed, update docs/README and the capability matrix, then publish a new version. Do not republish or mutate the immutable 0.0.15 artifacts. Preserve the unrelated `docs/launch.md` edits.

## Sources checked while planning

- [VS Code menu contributions and URI arguments](https://code.visualstudio.com/api/references/contribution-points#contributes.menus)
- [Django template Engine, loaders and context](https://docs.djangoproject.com/en/5.2/ref/templates/api/)
- [Jinja environment and loader API](https://jinja.palletsprojects.com/en/stable/api/)
- [Handlebars partials and dynamic partials](https://handlebarsjs.com/guide/partials.html)
- [Nunjucks environment, loaders and execution limits](https://mozilla.github.io/nunjucks/api.html)
- [Consolidate engine adapters and maintenance notes](https://github.com/ladjs/consolidate/)

Only the listed primary sources and current repository paths were checked for this plan. Other engines in the target matrix require their own API/version review and installed fixtures during their implementation stage.
