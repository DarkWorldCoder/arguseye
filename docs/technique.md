# Mirror rendering: how Arguseye shows a component as the app shows it

No dev server, no stories, no mocks. The technique has five parts; each is ours, and together they are what no other tool does. The pixels come from Chromium, on purpose: "exactly as in the app" is only true when the same engine draws it.

## 1. Real props from the code that already exists
Every JSX call site of the component is found by parsing the project (oxc), following imports and barrel re-exports back to the file. Literal props are read as values; props that depend on runtime data are reported as "unresolved" text. The first call site with props is what the preview shows by default, so the component appears the way the app already uses it. When nothing uses it yet, the TypeScript parameter type is read (aliases, interfaces with `extends`, imported types, enums, nested objects, defaults from destructuring) and sample props are made for the required ones.

## 2. The app's context, reconstructed statically
The root layout (`app/layout.tsx`, `pages/_app.tsx`, `src/main.tsx`) is parsed once: its global stylesheets, `<html>`/`<body>` classes, and the chain of providers around `{children}` with the literal props the layout passes. A generated wrapper module nests the component inside that same chain, so themes, contexts, fonts and host elements match. Stylesheets are compiled the way the app's bundler would: Sass, then the project's own Tailwind (v4 directly with its theme, v3 through its PostCSS config), then CSS modules via Lightning CSS. Framework modules that cannot run outside the app (`next/link`, `next/image`, `next/navigation`) are replaced by shims that render Next's markup.

## 3. One build, one React
Project files are transformed one module at a time (oxc, about 1 ms each) and served as native ES modules. Packages are bundled once by Rolldown from the project's own `node_modules` into shared chunks and cached on disk by package set, lockfile and bundler version. Before the first paint, the component's import graph and the providers' are crawled so every package is in that single build; if a later edit introduces a new package, the build generation changes and the page reloads instead of mixing two copies of React. ESM-or-CommonJS is decided from the file the bundler actually uses, and Node built-ins become empty modules.

## 4. A warm page that swaps targets
The preview page stays open. A new component, new props or a new usage is swapped in with `show(target)`, not a navigation. Unsaved editor buffers overlay the disk; an edit re-transforms only that file and React Fast Refresh swaps the component in place, so its state survives (about 35 ms from keystroke to pixels). CSS edits re-apply their `<style>`. Files changed on disk by an agent are picked up by comparing served mtimes before each render.

## 5. The settled frame, cheaply
For agents, the capture is the DevTools protocol directly: a clip to the component's box, transitions ended, finite animations jumped to their end state, caret hidden, and the screenshot and accessibility snapshot taken in parallel (about 40 ms warm). The result is token-cheap: a cropped PNG, a text tree, and `errors[]` with real file paths, including the server's reason when a module could not be served.
