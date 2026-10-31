/** What the preview page should show: a component export and the props to render it with. */
export type PreviewTarget = {
  file: string;
  exportName?: string;
  props?: Record<string, unknown>;
  /** Remount instead of keeping component state (agents want a clean render; the editor panel doesn't). */
  fresh?: boolean;
  /** Render inside the JSX ancestors of a call site (from `Usage.context`), resolved from `contextFile`. */
  context?: Wrapper[];
  contextFile?: string;
  /** Render inside a box of this size and background, as a stand-in parent. */
  frame?: Frame;
  /** The page file whose layouts/templates wrap this render (absolute); the root layout alone when absent. */
  route?: string;
  /**
   * Force a colour scheme: `dark` adds the `dark` class to <html> and sets `color-scheme` (the headless renderer
   * also emulates `prefers-color-scheme`); `light` removes the class. Absent, the app renders as written.
   */
  theme?: "light" | "dark";
};

export type Frame = { width: number; height: number; background?: string; padding?: number };

/** Encodes a context for the `/@context` module URL. */
export const encodeContext = (file: string, wrappers: Wrapper[]) =>
  Buffer.from(JSON.stringify({ file, wrappers })).toString("base64url");
export const decodeContext = (encoded: string): { file: string; wrappers: Wrapper[] } =>
  JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));

export function encodeTarget(target: PreviewTarget): string {
  return Buffer.from(JSON.stringify(target)).toString("base64url");
}

export function decodeTarget(encoded: string): PreviewTarget {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}

import type { Wrapper } from "../project/appContext.js";
import { frameworkOf } from "../project/framework.js";

export type PageContext = {
  state: { epoch: number; versions: Record<string, number>; live: boolean };
  /** `NEXT_PUBLIC_*` and friends from the project's env files, as the app's build would expose them. */
  env: Record<string, string>;
  htmlClass?: string;
  bodyClass?: string;
  /** Module URLs of the app's global stylesheets, loaded before the component so the cascade matches. */
  globalCssUrls: string[];
};

const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The app's own <html> class with `dark` added or removed for a forced theme; untouched when no theme is forced. */
export function themedClass(htmlClass: string | undefined, theme: PreviewTarget["theme"]): string | undefined {
  if (!theme) return htmlClass;
  const classes = (htmlClass ?? "").split(/\s+/).filter((c) => c && c !== "dark");
  if (theme === "dark") classes.push("dark");
  return classes.join(" ") || undefined;
}

export function previewHtml(target: PreviewTarget, { state, env, htmlClass, bodyClass, globalCssUrls }: PageContext): string {
  const json = JSON.stringify(target).replace(/</g, "\\u003c");
  const stateJson = JSON.stringify(state).replace(/</g, "\\u003c");
  const envJson = JSON.stringify({ NODE_ENV: "development", ...env }).replace(/</g, "\\u003c");
  const globals = globalCssUrls.map((u) => `<script type="module" src="${attr(u)}"></script>`).join("\n");
  return `<!doctype html>
<html${themedClass(htmlClass, target.theme) ? ` class="${attr(themedClass(htmlClass, target.theme)!)}"` : ""}${target.theme ? ` style="color-scheme:${target.theme}"` : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>
window.__CP__ = { target: ${json}, ...${stateJson}, status: "loading", errors: [] };
// Node globals that app packages read at runtime (process.env.X, global), as a bundler would provide.
window.__CP__.importModule = (url) => import(url);
window.process ??= { env: ${envJson} };
window.global ??= window;
const fail = (message) => { window.__CP__.errors.push(String(message)); window.__CP__.status = "error"; };
addEventListener("error", (e) => fail(e.error?.stack ?? e.message));
addEventListener("unhandledrejection", (e) => fail(e.reason?.stack ?? e.reason));
</script>
${frameworkOf(target.file) === "react" ? '<script type="module" src="/@refresh-setup"></script>' : ""}
${globals}
<script type="module" src="/@runtime${frameworkOf(target.file) === "react" ? "" : "?framework=" + frameworkOf(target.file)}"></script>
</head><body${bodyClass ? ` class="${attr(bodyClass)}"` : ""}><div id="root"></div></body></html>`;
}

/** Installs the React Refresh hook before react-dom loads (module scripts run in document order). */
export const refreshSetup = `import RR from "/@deps/react-refresh/runtime.js";
RR.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__CP__.refresh = RR;`;

/** Runs in the preview page: `__CP__.show(target)` renders a target into the already-loaded page. */
export const reactRuntime = `import { createElement } from "/@deps/react.js";
import { createRoot } from "/@deps/react-dom/client.js";
import { flushSync } from "/@deps/react-dom.js";

const cp = window.__CP__;
const fail = (error) => cp.errors.push(String(error?.stack ?? error));
const moduleUrl = (file) => "/@fs" + file + "?e=" + cp.epoch + (cp.versions[file] ? "&v=" + cp.versions[file] : "");
let root;
let mountKey = 0;

/** Props travel as JSON; a value shaped { "$fn": "(x) => ..." } becomes a real function (callbacks, formatters). */
const reviveProps = (value) => {
  if (Array.isArray(value)) return value.map(reviveProps);
  if (value && typeof value === "object") {
    if (typeof value.$fn === "string" && Object.keys(value).length === 1) return new Function("return (" + value.$fn + ")")();
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reviveProps(v)]));
  }
  return value;
};

/** Fetches the target's whole import graph in parallel (modulepreload), so a deep import tree costs one round, not one per level. */
const preloaded = new Set();
const preload = async (target) => {
  try {
    const q = "file=" + encodeURIComponent(target.file) + (target.route ? "&route=" + encodeURIComponent(target.route) : "");
    const urls = await (await fetch("/@graph?" + q)).json();
    const fresh = urls.filter((u) => !preloaded.has(u));
    for (const u of fresh) {
      preloaded.add(u);
      const link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = u;
      document.head.append(link);
    }
  } catch {}
};

/** A failed import() only says "failed to fetch"; the server kept the real reason. */
const explain = async (error, since) => {
  if (!/Failed to fetch|Importing a module script failed|error loading dynamically imported module/i.test(String(error))) return [String(error?.stack ?? error)];
  try {
    const served = await (await fetch("/@errors?since=" + since)).json();
    if (served.length) return served.map((e) => e.message);
  } catch {}
  return [String(error?.stack ?? error)];
};

/** The frame is settled once fonts are ready and the component's images have loaded (or 3 s passed). */
const settled = () => {
  // Lazy images below the fold would never load in a headless viewport (and the wait would hit the cap every time).
  for (const img of document.getElementById("root").querySelectorAll("img[loading=lazy]")) img.loading = "eager";
  const images = [...document.getElementById("root").querySelectorAll("img")].filter((img) => !img.complete);
  const loads = images.map((img) => new Promise((done) => { img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true }); }));
  const timeout = new Promise((done) => setTimeout(done, 3000));
  return Promise.race([Promise.all([document.fonts.ready, ...loads]), timeout]);
};

/**
 * The box a component is rendered into: a fixed frame, or the call site's JSX ancestors as a generated module.
 * The innermost element carries data-cp-box, which the capture crops to.
 */
const parentBox = async (target, since) => {
  if (target.frame) {
    const { width, height, background, padding } = target.frame;
    return ({ children }) => createElement("div", { "data-cp-box": "", style: { width, height, background, padding, boxSizing: "border-box", position: "relative", overflow: "hidden" } }, children);
  }
  if (target.context?.length && target.contextFile) {
    const encoded = btoa(JSON.stringify({ file: target.contextFile, wrappers: target.context })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    try {
      return (await import("/@context?c=" + encoded + "&e=" + cp.epoch)).default;
    } catch (error) {
      cp.errors.push(...(await explain(error, since)).map((e) => "Call-site context could not be loaded: " + e));
    }
  }
  return ({ children }) => children;
};

/** The root layout's providers, loaded once per epoch; a broken layout is reported and the component still renders. */
let wrapperKey = "", wrapper;
const appWrapper = async (since) => {
  const route = cp.target.route ? "&route=" + encodeURIComponent(cp.target.route) : "";
  const key = cp.epoch + route;
  if (wrapperKey === key && wrapper) return wrapper;
  try {
    wrapper = (await import("/@wrapper?e=" + cp.epoch + route)).default;
    wrapperKey = key;
  } catch (error) {
    cp.errors.push(...(await explain(error, since)).map((e) => "Root layout providers could not be loaded: " + e));
    wrapper = ({ children }) => children;
  }
  return wrapper;
};

cp.show = async (target, state) => {
  if (state) Object.assign(cp, state);
  cp.target = target;
  cp.errors = [];
  cp.status = "loading";
  const since = Date.now();
  // A forced theme: the dark class and color-scheme on <html>; without one, the app's own class stays as it is.
  if (target.theme) { document.documentElement.classList.toggle("dark", target.theme === "dark"); document.documentElement.style.colorScheme = target.theme; }
  try {
    await preload(target);
    const mod = await import(target.file === "/@empty" ? "/@fs/@empty" : moduleUrl(target.file));
    const name = target.exportName ?? "default";
    const Component = mod[name];
    if (typeof Component !== "function" && (typeof Component !== "object" || Component === null)) {
      const available = Object.keys(mod).join(", ") || "none";
      throw new Error("No component export " + JSON.stringify(name) + " in " + target.file + " (exports: " + available + ")");
    }
    root ??= createRoot(document.getElementById("root"), { onUncaughtError: fail, onRecoverableError: fail });
    if (target.fresh) mountKey++;
    const Wrapper = await appWrapper(since);
    const Box = await parentBox(target, since);
    flushSync(() => root.render(createElement(Wrapper, null, createElement(Box, null, createElement(Component, { ...reviveProps(target.props), key: mountKey })))));
    await settled();
  } catch (error) {
    cp.errors.push(...(await explain(error, since)));
  }
  cp.status = cp.errors.length ? "error" : "mounted";
  return cp.status;
};

/** Tells a hosting panel (the VS Code webview) what is shown, so it can display status and errors. */
cp.report = () => {
  if (window.parent === window) return;
  const root = document.getElementById("root");
  window.parent.postMessage(
    { source: "arguseye", file: cp.target.file, status: cp.status, errors: [...cp.errors], text: root.innerText },
    "*",
  );
};
addEventListener("message", async (event) => {
  if (event.data?.type !== "cp:show") return;
  await cp.show(event.data.target);
  cp.report();
});

cp.ready = cp.show(cp.target).then(cp.report);

/** Live updates pushed by the server as files change (saved or not). */
cp.updates = 0;
if (cp.live) new EventSource("/@events").onmessage = async (event) => {
  const update = JSON.parse(event.data);
  if (update.full) return location.reload();
  cp.epoch = update.epoch;
  cp.versions = update.versions;
  try {
    if (update.kind === "reload") {
      await cp.show({ ...cp.target, fresh: false });
    } else {
      await import(moduleUrl(update.file));
      if (update.kind === "refresh") cp.refresh.performReactRefresh();
    }
  } catch (error) {
    fail(error);
    cp.status = "error";
  }
  cp.updates++;
  cp.report();
};`;
