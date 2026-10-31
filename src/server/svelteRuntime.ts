/** Svelte's warm page runtime: each show mounts the component afresh (Svelte 5 `mount`, or `new Component` on 4). */
export const svelteRuntime = `import * as svelte from "/@deps/svelte.js";
const cp = window.__CP__;
cp.warnings = [];
let instance;
const moduleUrl = (file) => "/@fs" + file + "?e=" + cp.epoch + (cp.versions[file] ? "&v=" + cp.versions[file] : "");
const reviveProps = (value) => {
  if (Array.isArray(value)) return value.map(reviveProps);
  if (value && typeof value === "object") {
    if (typeof value.$fn === "string" && Object.keys(value).length === 1) return new Function("return (" + value.$fn + ")")();
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reviveProps(v)]));
  }
  return value;
};
const host = (target) => {
  const root = document.getElementById("root");
  root.replaceChildren();
  if (!target.frame) return root;
  const { width, height, background, padding } = target.frame;
  const box = document.createElement("div");
  box.dataset.cpBox = "";
  Object.assign(box.style, { width: width + "px", height: height + "px", background: background ?? "", padding: padding ? padding + "px" : "", boxSizing: "border-box", position: "relative", overflow: "hidden" });
  root.append(box);
  return box;
};
const destroy = () => {
  if (!instance) return;
  try { svelte.unmount ? svelte.unmount(instance) : instance.$destroy(); } catch {}
  instance = undefined;
};
cp.show = async (target, state) => {
  if (state) Object.assign(cp, state);
  cp.target = target; cp.errors = []; cp.warnings = []; cp.status = "loading";
  try {
    const mod = await import(moduleUrl(target.file));
    const name = target.exportName ?? "default";
    const Component = mod[name];
    if (!Component) throw new Error("No component export " + JSON.stringify(name) + " in " + target.file);
    destroy();
    const props = reviveProps(target.props ?? {});
    const into = host(target);
    instance = svelte.mount ? svelte.mount(Component, { target: into, props }) : new Component({ target: into, props });
    if (svelte.flushSync) svelte.flushSync(); else await svelte.tick();
  } catch (error) {
    const served = await fetch("/@errors?since=" + (Date.now() - 5000)).then((r) => r.json()).catch(() => []);
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
let updates = Promise.resolve();
if (cp.live) new EventSource("/@events").onmessage = (event) => {
  updates = updates.then(async () => {
    const update = JSON.parse(event.data);
    if (update.full) return location.reload();
    cp.epoch = update.epoch; cp.versions = update.versions;
    await cp.show({ ...cp.target, fresh: true });
    cp.warnings = ["Component state reset after an edit (Svelte previews remount)."];
    cp.updates++; cp.report();
  });
};`;
