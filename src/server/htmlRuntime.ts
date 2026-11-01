/** Plain HTML/Web Components have their own mounting and readiness contract, with no JSX framework dependencies. */
export const htmlRuntime = `const cp = window.__CP__;
const moduleUrl = (file) => cp.fileUrl(file) + "?e=" + cp.epoch + (cp.versions[file] ? "&v=" + cp.versions[file] : "");
const revive = (value) => {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === "object") {
    if (typeof value.$fn === "string" && Object.keys(value).length === 1) return new Function("return (" + value.$fn + ")")();
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,revive(v)]));
  }
  return value;
};
cp.show = async (target, state) => {
  if (state) Object.assign(cp, state);
  cp.target = target; cp.errors = []; cp.warnings = []; cp.status = "loading";
  try {
    const documentSource = (await import(moduleUrl(target.file))).default;
    cp.warnings.push(...documentSource.warnings);
    const parsed = new DOMParser().parseFromString(documentSource.html, "text/html");
    document.documentElement.lang = parsed.documentElement.lang;
    document.documentElement.dir = parsed.documentElement.dir;
    const classes = parsed.documentElement.className.split(" ").filter(Boolean).filter((name) => !target.theme || name !== "dark");
    if (target.theme === "dark") classes.push("dark");
    document.documentElement.className = classes.join(" "); document.body.className = parsed.body.className;
    document.body.style.cssText = parsed.body.style.cssText;
    const root = document.getElementById("root"); root.replaceChildren();
    let into = root;
    if (target.frame) {
      into = document.createElement("div"); into.dataset.cpBox = "";
      Object.assign(into.style, { width: target.frame.width + "px", height: target.frame.height + "px", padding: (target.frame.padding ?? 0) + "px", background: target.frame.background ?? "", boxSizing: "border-box" }); root.append(into);
    }
    for (const node of [...parsed.head.querySelectorAll("style"), ...parsed.body.childNodes]) into.append(document.importNode(node, true));
    for (const sheet of documentSource.styles) {
      if (sheet.startsWith("http:") || sheet.startsWith("https:") || sheet.startsWith("//")) { cp.warnings.push("External HTML stylesheet is not reconstructed: " + sheet); continue; }
      await cp.importModule(sheet);
    }
    for (const script of documentSource.scripts) {
      if (script.kind !== "module") throw new Error("Classic scripts are unsupported in isolated HTML previews; use type=module or verify the full application.");
      await cp.importModule(script.url);
    }
    const custom = [...into.querySelectorAll("*")].filter((el) => el.localName.includes("-"));
    const missing = [...new Set(custom.filter((el) => !customElements.get(el.localName)).map((el) => el.localName))];
    if (missing.length) {
      await Promise.race([Promise.all(missing.map((name) => customElements.whenDefined(name))), new Promise((done) => setTimeout(done, 500))]);
      const unresolved = missing.filter((name) => !customElements.get(name));
      if (unresolved.length) cp.warnings.push("Custom elements were not registered within 500 ms: " + unresolved.join(", "));
    }
    const name = target.exportName ?? "default";
    const selected = name === "default" ? custom.length === 1 ? custom[0] : undefined : custom.find((el) => el.localName === name);
    if (name !== "default" && !selected) throw new Error("No custom element " + JSON.stringify(name) + " in " + target.file);
    if (Object.keys(target.props ?? {}).length) {
      if (selected) Object.assign(selected, revive(target.props));
      else cp.warnings.push("HTML props require one custom element or its tag name as the export; no props were applied.");
    }
    // The document stylesheet cannot freeze animation inside an open shadow root.
    if (!cp.live) for (const element of custom) if (element.shadowRoot) {
      const style = document.createElement("style");
      style.textContent = "*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;caret-color:transparent!important}";
      element.shadowRoot.append(style);
    }
    let settled = false;
    await Promise.race([Promise.all(custom.map((el) => el.updateComplete)).then(() => { settled = true; }), new Promise((done) => setTimeout(done, 500))]);
    if (!settled) cp.warnings.push("Custom element updates did not settle within 500 ms.");
    await cp.quiet();
  } catch (error) {
    const served = await cp.realFetch("/@errors?since=" + (Date.now() - 5000)).then((r) => r.json()).catch(() => []);
    cp.errors.push(...(served.length ? served.map((e) => e.message) : [String(error?.stack ?? error)]));
  }
  cp.status = cp.errors.length ? "error" : "mounted"; return cp.status;
};
cp.report = () => { if (parent !== window) parent.postMessage({ source: "arguseye", file: cp.target.file, status: cp.status, errors: cp.errors, warnings: cp.warnings, text: document.getElementById("root").innerText }, "*"); };
addEventListener("message", async (event) => { if (event.source === parent && event.data?.type === "cp:show") { await cp.show(event.data.target); cp.report(); } });
cp.ready = cp.show(cp.target).then(cp.report);
cp.updates = 0;
if (cp.live) new EventSource("/@events").onmessage = () => location.reload();`;
