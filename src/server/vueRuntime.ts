/** Vue's warm page runtime: template/style HMR preserves state; script changes explicitly reset it. */
export const vueRuntime = `import { createApp, h, shallowRef, nextTick, Suspense } from "/@deps/vue.js";
const cp = window.__CP__;
cp.warnings = [];
const component = shallowRef(null);
let props = {}, key = 0, app, pending = false, setupWarnings = [];
/** Function ({ "$fn": src }) and date ({ "$date": iso }) props arrive as JSON, as in the React runtime. */
const revive = (value) => {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === "object") {
    if (typeof value.$fn === "string" && Object.keys(value).length === 1) return new Function("return (" + value.$fn + ")")();
    if (typeof value.$date === "string" && Object.keys(value).length === 1) return new Date(value.$date);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v)]));
  }
  return value;
};
const moduleUrl = (file) => cp.fileUrl(file) + "?e=" + cp.epoch + (cp.versions[file] ? "&v=" + cp.versions[file] : "");
cp.show = async (target, state) => {
  if (state) Object.assign(cp, state);
  cp.target = target; cp.errors = []; cp.warnings = []; cp.status = "loading";
  try {
    const mod = await import(moduleUrl(target.file));
    const name = target.exportName ?? "default";
    if (!mod[name]) throw new Error("No component export " + JSON.stringify(name) + " in " + target.file);
    // Verification must recreate plugin/provide state too; live template/style edits keep their app.
    if (target.fresh) { key++; if (app) { app.unmount(); app = undefined; } }
    props = revive(target.props ?? {}); component.value = mod[name];
    if (!app) {
      setupWarnings = [];
      // Inside <Suspense>, as apps render pages: components with a top-level await and async components resolve.
      app = createApp({
        render: () => component.value ? h(Suspense, { onPending: () => (pending = true), onResolve: () => (pending = false) }, { default: () => h(component.value, { ...props, key }) }) : null,
      });
      app.config.errorHandler = (error) => { cp.errors.push(String(error?.stack ?? error)); cp.status = "error"; };
      app.config.warnHandler = (warning) => cp.warnings.push(warning);
      // The plugins, global components, directives and provides src/main installs on the app (Pinia, router, i18n, UI kits).
      try {
        const setup = (await import("/@vue-setup?e=" + cp.epoch)).default;
        if (setup) await setup(app);
      } catch (error) {
        setupWarnings.push("Vue app setup could not run, so its plugins are missing: " + (error?.message ?? error));
      }
      // Components the project uses without importing (unplugin-vue-components, Nuxt), loaded on first use.
      try {
        const register = (await import("/@vue-components?e=" + cp.epoch)).default;
        if (register) register(app);
      } catch (error) {
        setupWarnings.push("Auto-registered components could not be loaded: " + (error?.message ?? error));
      }
      app.mount("#root");
    } else app._instance?.proxy?.$forceUpdate();
    cp.warnings.push(...setupWarnings);
    await nextTick();
    // Lazy parts, top-level awaits and data requested on mount.
    await cp.quiet(() => pending);
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
    try {
      const mod = await import(moduleUrl(update.file));
      if (mod.__cpVueChange === "script") {
        cp.warnings = ["Component state reset after a Vue script edit."];
      } else if (!update.file.endsWith(".vue") && update.kind === "reload") {
        await cp.show({ ...cp.target, fresh: true });
        cp.warnings = ["Component state reset after a dependency edit."];
      }
      await nextTick();
      cp.status = cp.errors.length ? "error" : "mounted";
    } catch (error) { cp.errors.push(String(error?.stack ?? error)); cp.status = "error"; }
    cp.updates++; cp.report();
  });
};`;
