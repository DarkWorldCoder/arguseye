/** Svelte's warm page runtime: each show mounts the component afresh (Svelte 5 `mount`, or `new Component` on 4). */
export const svelteRuntime = `import * as svelte from "/@deps/svelte.js";
const cp = window.__CP__;
cp.warnings = [];
let instance;
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
  const since = cp.now();
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
    let context;
    try {
      const setup = (await import("/@svelte-setup?e=" + cp.epoch)).default;
      if (setup) { context = await setup(); if (!(context instanceof Map)) throw new Error("Svelte setup must return a Map of context keys and values."); }
    } catch (error) { cp.warnings.push("Svelte context setup could not run: " + (error?.message ?? error)); }
    instance = svelte.mount ? svelte.mount(Component, { target: into, props, context }) : new Component({ target: into, props, context });
    if (svelte.flushSync) svelte.flushSync(); else await svelte.tick();
    // Components with top-level await (experimental.async) mount empty and fill in later; svelte.settled() can
    // resolve before that work is tracked, so wait for content to appear (2 s cap), then for 50 ms of quiet.
    if (svelte.settled) await Promise.race([svelte.settled(), new Promise((done) => cp.setTimeout(done, 2000))]);
    if (!into.textContent.trim() && !into.querySelector("*:not(template)")) await new Promise((done) => {
      let quiet;
      const observer = new MutationObserver(() => { clearTimeout(quiet); quiet = cp.setTimeout(finish, 50); });
      const cap = cp.setTimeout(finish, 2000);
      function finish() { observer.disconnect(); clearTimeout(cap); clearTimeout(quiet); done(undefined); }
      observer.observe(into, { childList: true, subtree: true, characterData: true });
    });
  } catch (error) {
    const served = await fetch("/@errors?since=" + since).then((r) => r.json()).catch(() => []);
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
