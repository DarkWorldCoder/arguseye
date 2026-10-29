/** Vue's warm page runtime: template/style HMR preserves state; script changes explicitly reset it. */
export const vueRuntime = `import { createApp, h, shallowRef, nextTick } from "/@deps/vue.js";
const cp = window.__CP__;
cp.warnings = [];
const component = shallowRef(null);
let props = {}, key = 0, app;
const moduleUrl = (file) => "/@fs" + file + "?e=" + cp.epoch + (cp.versions[file] ? "&v=" + cp.versions[file] : "");
cp.show = async (target, state) => {
  if (state) Object.assign(cp, state);
  cp.target = target; cp.errors = []; cp.warnings = []; cp.status = "loading";
  try {
    const mod = await import(moduleUrl(target.file));
    const name = target.exportName ?? "default";
    if (!mod[name]) throw new Error("No component export " + JSON.stringify(name) + " in " + target.file);
    if (target.fresh) key++;
    props = target.props ?? {}; component.value = mod[name];
    if (!app) {
      app = createApp({ render: () => component.value ? h(component.value, { ...props, key }) : null });
      app.config.errorHandler = (error) => { cp.errors.push(String(error?.stack ?? error)); cp.status = "error"; };
      app.config.warnHandler = (warning) => cp.warnings.push(warning);
      app.mount("#root");
    } else app._instance?.proxy?.$forceUpdate();
    await nextTick();
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
