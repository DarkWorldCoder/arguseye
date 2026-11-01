/** Solid's warm page runtime: Solid's render inside an ErrorBoundary and the layout's providers; edits remount. */
export const solidRuntime = `import { createComponent, ErrorBoundary } from "/@deps/solid-js.js";
import { render, insert } from "/@deps/solid-js/web.js";
const cp = window.__CP__;
cp.warnings = [];
const moduleUrl = (file) => cp.fileUrl(file) + "?e=" + cp.epoch + (cp.versions[file] ? "&v=" + cp.versions[file] : "");
const reviveProps = (value) => {
  if (Array.isArray(value)) return value.map(reviveProps);
  if (value && typeof value === "object") {
    if (typeof value.$fn === "string" && Object.keys(value).length === 1) return new Function("return (" + value.$fn + ")")();
    if (typeof value.$date === "string" && Object.keys(value).length === 1) return new Date(value.$date);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reviveProps(v)]));
  }
  return value;
};
let wrapperKey = "", wrapper, dispose;
const appWrapper = async () => {
  const route = cp.target.route ? "&route=" + encodeURIComponent(cp.target.route) : "";
  const key = cp.epoch + route;
  if (wrapperKey === key && wrapper) return wrapper;
  try {
    wrapper = (await import("/@wrapper?e=" + cp.epoch + route)).default;
    wrapperKey = key;
  } catch (error) {
    cp.errors.push("Root layout providers could not be loaded: " + (error?.message ?? error));
    wrapper = (props) => props.children;
  }
  return wrapper;
};
const box = (target, child) => {
  if (!target.frame) return child();
  const { width, height, background, padding } = target.frame;
  const el = document.createElement("div");
  el.dataset.cpBox = "";
  Object.assign(el.style, { width: width + "px", height: height + "px", background: background ?? "", padding: padding ? padding + "px" : "", boxSizing: "border-box", position: "relative", overflow: "hidden" });
  insert(el, child);
  return el;
};
cp.show = async (target, state) => {
  if (state) Object.assign(cp, state);
  cp.target = target; cp.errors = []; cp.warnings = []; cp.status = "loading";
  cp.pathname = target.pathname ?? "/"; cp.params = target.params ?? {};
  try {
    const mod = await import(moduleUrl(target.file));
    const name = target.exportName ?? "default";
    const Component = name.split(".").reduce((value, key) => value?.[key], mod);
    if (typeof Component !== "function") throw new Error("No component export " + JSON.stringify(name) + " in " + target.file + " (exports: " + (Object.keys(mod).join(", ") || "none") + ")");
    const Wrapper = await appWrapper();
    const props = reviveProps(target.props ?? {});
    const root = document.getElementById("root");
    dispose?.();
    root.replaceChildren();
    dispose = render(() => createComponent(ErrorBoundary, {
      fallback: (error) => { cp.errors.push(String(error?.stack ?? error)); return null; },
      get children() { return createComponent(Wrapper, { get children() { return box(target, () => createComponent(Component, props)); } }); },
    }), root);
    await cp.quiet();
    const images = [...root.querySelectorAll("img")].filter((img) => !img.complete);
    await Promise.race([Promise.all([document.fonts.ready, ...images.map((img) => new Promise((done) => { img.onload = img.onerror = done; }))]), new Promise((done) => setTimeout(done, 3000))]);
  } catch (error) {
    const served = await cp.realFetch("/@errors?since=" + (Date.now() - 5000)).then((r) => r.json()).catch(() => []);
    cp.errors.push(...(served.length ? served.map((e) => e.message) : [String(error?.stack ?? error)]));
  }
  cp.status = cp.errors.length ? "error" : "mounted";
  return cp.status;
};
cp.report = () => {
  if (parent !== window) parent.postMessage({ source: "arguseye", file: cp.target.file, status: cp.status, errors: [...cp.errors], warnings: [...cp.warnings], text: document.getElementById("root").innerText }, "*");
};
addEventListener("message", async (event) => {
  if (event.source !== parent || event.data?.type !== "cp:show") return;
  await cp.show(event.data.target); cp.report();
});
cp.ready = cp.show(cp.target).then(cp.report);
cp.updates = 0;
if (cp.live) new EventSource("/@events").onmessage = async (event) => {
  const update = JSON.parse(event.data);
  if (update.full) return location.reload();
  cp.epoch = update.epoch; cp.versions = update.versions;
  await cp.show({ ...cp.target, fresh: false });
  cp.warnings.push("Component state reset after an edit (Solid previews remount).");
  cp.updates++;
  cp.report();
};
`;
