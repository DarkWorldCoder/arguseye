/** What the preview page should show: a component export and the props to render it with. */
export type PreviewTarget = {
  file: string;
  exportName?: string;
  props?: Record<string, unknown>;
  /** Remount instead of keeping component state (agents want a clean render; the editor panel doesn't). */
  fresh?: boolean;
};

export function encodeTarget(target: PreviewTarget): string {
  return Buffer.from(JSON.stringify(target)).toString("base64url");
}

export function decodeTarget(encoded: string): PreviewTarget {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}

export function previewHtml(target: PreviewTarget, state: { epoch: number; versions: Record<string, number> }): string {
  const json = JSON.stringify(target).replace(/</g, "\\u003c");
  const stateJson = JSON.stringify(state).replace(/</g, "\\u003c");
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>
window.__CP__ = { target: ${json}, ...${stateJson}, status: "loading", errors: [] };
const fail = (message) => { window.__CP__.errors.push(String(message)); window.__CP__.status = "error"; };
addEventListener("error", (e) => fail(e.error?.stack ?? e.message));
addEventListener("unhandledrejection", (e) => fail(e.reason?.stack ?? e.reason));
</script>
<script type="module" src="/@refresh-setup"></script>
<script type="module" src="/@runtime"></script>
</head><body style="margin:0"><div id="root" style="display:inline-block;min-width:1px"></div></body></html>`;
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

cp.show = async (target) => {
  cp.target = target;
  cp.errors = [];
  cp.status = "loading";
  try {
    const mod = await import(moduleUrl(target.file));
    const Component = mod[target.exportName ?? "default"] ?? mod.default;
    if (typeof Component !== "function" && typeof Component !== "object") {
      throw new Error("No component export " + JSON.stringify(target.exportName ?? "default") + " in " + target.file);
    }
    root ??= createRoot(document.getElementById("root"), { onUncaughtError: fail, onRecoverableError: fail });
    if (target.fresh) mountKey++;
    flushSync(() => root.render(createElement(Component, { ...target.props, key: mountKey })));
  } catch (error) {
    fail(error);
  }
  cp.status = cp.errors.length ? "error" : "mounted";
  return cp.status;
};

cp.ready = cp.show(cp.target);

/** Live updates pushed by the server as files change (saved or not). */
cp.updates = 0;
new EventSource("/@events").onmessage = async (event) => {
  const update = JSON.parse(event.data);
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
};`;
