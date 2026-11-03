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
// Classic scripts share one global scope: they run once per page, on a page nothing else has run on.
const encodeTarget = (target) => {
  let binary = "";
  for (const byte of new TextEncoder().encode(JSON.stringify(target))) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
};
const shadowRoots = [], frozen = new WeakSet();
let closedRoots = 0, watcher, writeInto, headWrites;
/** Counts what classic widgets load on their own (script/style/iframe elements, XHR) as requests in flight. */
const watchClassicLoads = () => {
  const net = cp.net, settle = () => { net.inFlight--; net.last = performance.now(); };
  const track = (el) => {
    const loads = el.localName === "script" && el.src || el.localName === "iframe" && el.src || el.localName === "link" && el.rel === "stylesheet" && el.href;
    if (!loads || el.dataset.cpTracked) return;
    el.dataset.cpTracked = ""; net.inFlight++;
    let done = false; const end = () => { if (!done) { done = true; settle(); } };
    el.addEventListener("load", end, { once: true }); el.addEventListener("error", end, { once: true });
  };
  watcher = new MutationObserver((records) => { for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) { track(node); node.querySelectorAll("script[src],iframe[src],link[rel=stylesheet]").forEach(track); } });
  watcher.observe(document, { childList: true, subtree: true });
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) { net.inFlight++; this.addEventListener("loadend", settle, { once: true }); return send.apply(this, args); };
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const root = attach.call(this, init);
    shadowRoots.push(root); if (init?.mode === "closed") closedRoots++;
    watcher.observe(root, { childList: true, subtree: true });
    return root;
  };
  // A parser would put written markup where the script is; after load a real page would be replaced, so that is refused.
  const write = (markup) => {
    const script = document.currentScript;
    if (!script?.isConnected) { cp.warnings.push("document.write() outside a running script was ignored; a real page would have replaced the whole document."); return; }
    // Written from <head>, content starts the body (as the parser would move it there), in write order.
    if (document.head.contains(script)) {
      headWrites ??= writeInto.insertBefore(document.createComment("document.write"), writeInto.firstChild);
      const parsed = document.createElement("template"); parsed.innerHTML = markup; headWrites.before(parsed.content);
    } else script.insertAdjacentHTML("beforebegin", markup);
    if (/<script/i.test(markup)) cp.warnings.push("document.write() markup was inserted before its script; scripts inside that markup did not run.");
  };
  document.write = (...parts) => write(parts.join(""));
  document.writeln = (...parts) => write(parts.join("") + "\\n");
};
const runClassic = (script, into) => new Promise((done, fail) => {
  const element = document.createElement("script");
  for (const [name, value] of Object.entries(script.attrs ?? {})) element.setAttribute(name, value);
  const placeholder = into.querySelector('script[data-cp-script="' + script.index + '"]');
  if (script.url) {
    element.addEventListener("load", () => done(), { once: true });
    element.addEventListener("error", () => fail(new Error("Classic script did not load: " + (script.src ?? script.url))), { once: true });
    element.src = script.url;
  } else element.textContent = script.text ?? "";
  // A placeholder outside the body (a <head> script) has no counterpart in the preview: head is where it ran.
  if (placeholder) placeholder.replaceWith(element); else if (script.head) document.head.append(element); else into.append(element);
  if (!script.url) done();
});
const freezeShadowRoots = () => {
  for (const root of shadowRoots) if (!frozen.has(root)) {
    frozen.add(root);
    const style = document.createElement("style");
    style.textContent = "*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;caret-color:transparent!important}";
    root.append(style);
  }
};
cp.show = async (target, state) => {
  if (cp.ranClassic || cp.templateHasScripts) { location.replace("/?t=" + encodeTarget(target) + (cp.live ? "" : "&live=0")); return new Promise(() => {}); }
  const sequence = cp.sequence = (cp.sequence ?? 0) + 1;
  const since = cp.now();
  if (state) Object.assign(cp, state);
  cp.target = target; cp.errors = []; cp.warnings = []; cp.template = undefined; cp.status = "loading";
  try {
    // A widget script is a document with one classic script; data-* props become that script's attributes.
    const documentSource = target.script
      ? { html: "", styles: [], warnings: [], scripts: [{ kind: "classic", src: target.file.split(/[\\\\/]/).pop(), url: moduleUrl(target.file).replace("?", "?classic&"), attrs: Object.fromEntries(Object.entries(target.props ?? {}).filter(([name]) => name.startsWith("data-")).map(([name, value]) => [name, String(value)])) }] }
      : target.engine ? await cp.realFetch("/@template", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(target) }).then(async (response) => { if (!response.ok) throw new Error(await response.text()); return response.json(); })
      : (await import(moduleUrl(target.file))).default;
    if (sequence !== cp.sequence) return cp.status;
    cp.template = documentSource.template;
    cp.errors.push(...(documentSource.errors ?? []));
    cp.warnings.push(...documentSource.warnings);
    const parsed = new DOMParser().parseFromString(documentSource.html, "text/html");
    for (const [actual, source] of [[document.documentElement, parsed.documentElement], [document.body, parsed.body]]) {
      for (const attribute of [...actual.attributes]) actual.removeAttribute(attribute.name);
      for (const attribute of source.attributes) {
        if (attribute.name === "id" && attribute.value === "root" || attribute.name.startsWith("on")) { cp.warnings.push("Document attribute " + attribute.name + " requires the full document lifecycle or conflicts with the preview root."); continue; }
        actual.setAttribute(attribute.name, attribute.value);
      }
    }
    const classes = document.documentElement.className.split(" ").filter(Boolean).filter((name) => !target.theme || name !== "dark");
    if (target.theme === "dark") classes.push("dark");
    document.documentElement.className = classes.join(" ");
    if (target.theme) document.documentElement.style.colorScheme = target.theme;
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
    // As a parser runs them: classic scripts in document order, then (deferred) module scripts.
    const classic = documentSource.scripts.map((script, index) => ({ ...script, index, head: !!parsed.head.querySelector('script[data-cp-script="' + index + '"]') })).filter((script) => script.kind === "classic");
    if (classic.length) {
      cp.ranClassic = true; writeInto = into;
      watchClassicLoads();
      if (target.script) window.__ARGUSEYE_WIDGET_CONFIG__ = revive(target.props ?? {});
      for (const script of classic) await runClassic(script, into);
    }
    // Native document scripts initialize real globals; another verification needs a fresh document realm.
    cp.templateHasScripts = !!target.engine && documentSource.scripts.some((script) => script.kind === "module");
    for (const script of documentSource.scripts) if (script.kind === "module") await cp.importModule(script.url);
    const custom = [...into.querySelectorAll("*")].filter((el) => el.localName.includes("-"));
    const missing = [...new Set(custom.filter((el) => !customElements.get(el.localName)).map((el) => el.localName))];
    if (missing.length) {
      await Promise.race([Promise.all(missing.map((name) => customElements.whenDefined(name))), new Promise((done) => cp.setTimeout(done, 500))]);
      const unresolved = missing.filter((name) => !customElements.get(name));
      if (unresolved.length) cp.warnings.push("Custom elements were not registered within 500 ms: " + unresolved.join(", "));
    }
    const name = target.exportName ?? "default";
    const selected = name === "default" ? custom.length === 1 ? custom[0] : undefined : custom.find((el) => el.localName === name);
    if (name !== "default" && !selected) throw new Error("No custom element " + JSON.stringify(name) + " in " + target.file);
    if (Object.keys(target.props ?? {}).length && !target.script && !target.engine) {
      if (selected) Object.assign(selected, revive(target.props));
      else cp.warnings.push("HTML props require one custom element or its tag name as the export; no props were applied.");
    }
    // The document stylesheet cannot freeze animation inside an open shadow root.
    if (!cp.live) for (const element of custom) if (element.shadowRoot) {
      const style = document.createElement("style");
      style.textContent = "*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;caret-color:transparent!important}";
      element.shadowRoot.append(style);
    }
    if (!cp.live) freezeShadowRoots();
    let settled = false;
    await Promise.race([Promise.all(custom.map((el) => el.updateComplete)).then(() => { settled = true; }), new Promise((done) => cp.setTimeout(done, 500))]);
    if (!settled) cp.warnings.push("Custom element updates did not settle within 500 ms.");
    await cp.quiet();
    if (classic.length) {
      if (!cp.live) freezeShadowRoots();
      if (closedRoots) cp.warnings.push(closedRoots + " closed shadow root(s): their content is in the image only, not in the accessibility snapshot.");
    }
  } catch (error) {
    if (sequence !== cp.sequence) return cp.status;
    const served = await cp.realFetch("/@errors?since=" + since).then((r) => r.json()).catch(() => []);
    cp.errors.push(...(served.length ? served.map((e) => e.message) : [String(error?.stack ?? error)]));
  }
  cp.status = cp.errors.length ? "error" : "mounted"; return cp.status;
};
cp.report = () => { if (parent !== window) parent.postMessage({ source: "arguseye", file: cp.target.file, status: cp.status, errors: cp.errors, warnings: cp.warnings, text: document.getElementById("root").innerText }, "*"); };
addEventListener("message", async (event) => { if (event.source === parent && event.data?.type === "cp:show") { await cp.show(event.data.target); cp.report(); } });
cp.ready = cp.show(cp.target).then(cp.report);
cp.updates = 0;
if (cp.live) new EventSource("/@events").onmessage = async (event) => {
  if (!cp.target.engine || cp.ranClassic || cp.templateHasScripts) { location.replace("/?t=" + encodeTarget(cp.target)); return; }
  const update = JSON.parse(event.data); cp.epoch = update.epoch; cp.versions = update.versions;
  await cp.show(cp.target); cp.report();
};`;
