/** Preact's warm page runtime: Preact's own render, the layout's providers, an error boundary; edits remount. */
export const preactRuntime = `import { h, render, Component as Base } from "/@deps/preact.js";
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
/** A render error is reported, not thrown past the page. */
class Boundary extends Base {
  componentDidCatch(error) { cp.errors.push(String(error?.stack ?? error)); this.setState({ failed: true }); }
  render() { return this.state.failed ? null : this.props.children; }
}
let wrapperKey = "", wrapper;
const appWrapper = async () => {
  const route = cp.target.route ? "&route=" + encodeURIComponent(cp.target.route) : "";
  const key = cp.epoch + route;
  if (wrapperKey === key && wrapper) return wrapper;
  try {
    wrapper = (await import("/@wrapper?e=" + cp.epoch + route)).default;
    wrapperKey = key;
  } catch (error) {
    cp.errors.push("Root layout providers could not be loaded: " + (error?.message ?? error));
    wrapper = ({ children }) => children;
  }
  return wrapper;
};
const box = (target, child) => {
  if (!target.frame) return child;
  const { width, height, background, padding } = target.frame;
  return h("div", { "data-cp-box": "", style: { width: width + "px", height: height + "px", background: background ?? "", padding: padding ? padding + "px" : "", boxSizing: "border-box", position: "relative", overflow: "hidden" } }, child);
};
let mount = 0;
cp.show = async (target, state) => {
  const since = cp.now();
  if (state) Object.assign(cp, state);
  cp.target = target; cp.errors = []; cp.warnings = []; cp.status = "loading";
  cp.pathname = target.pathname ?? "/"; cp.params = target.params ?? {};
  try {
    const mod = await import(moduleUrl(target.file));
    const name = target.exportName ?? "default";
    const Component = name.split(".").reduce((value, key) => value?.[key], mod);
    if (typeof Component !== "function") throw new Error("No component export " + JSON.stringify(name) + " in " + target.file + " (exports: " + (Object.keys(mod).join(", ") || "none") + ")");
    if (target.fresh !== false) mount++;
    const Wrapper = await appWrapper();
    render(h(Boundary, { key: mount }, h(Wrapper, null, box(target, h(Component, reviveProps(target.props ?? {}))))), document.getElementById("root"));
    // Data requested on mount, then fonts and images (as the React runtime).
    await cp.quiet();
    const images = [...document.getElementById("root").querySelectorAll("img")].filter((img) => !img.complete);
    await Promise.race([Promise.all([document.fonts.ready, ...images.map((img) => new Promise((done) => { img.onload = img.onerror = done; }))]), new Promise((done) => cp.setTimeout(done, 3000))]);
  } catch (error) {
    const served = await cp.realFetch("/@errors?since=" + since).then((r) => r.json()).catch(() => []);
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
  // Preact has no Fast Refresh here: an edit re-renders the component (state resets).
  await cp.show({ ...cp.target, fresh: false });
  cp.warnings.push("Component state reset after an edit (Preact previews re-render).");
  cp.updates++;
  cp.report();
};
`;
