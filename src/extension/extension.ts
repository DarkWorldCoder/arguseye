import * as vscode from "vscode";
import { findUsages } from "../usages/findUsages.js";
import { routeFor } from "../project/routeFor.js";
import { existsSync } from "node:fs";
import path from "node:path";
import type { PreviewServer } from "../server/createPreviewServer.js";
import type { PreviewTarget } from "../server/page.js";
import { listExports, pickExport } from "../project/pickExport.js";
import { createUsageIndex } from "../usages/createUsageIndex.js";
import type { Usage } from "../usages/findUsages.js";
import type { Renderer, RenderResult } from "../agent/createRenderer.js";
import type { DiffResult } from "../agent/compareCaptures.js";
import { diffEvidence } from "../agent/renderEvidence.js";
import { VIEWPORTS } from "../agent/viewports.js";
import { propsSchema, sampleProps, type PropSchema } from "../props/propsSchema.js";

/** What the preview page last reported, mirrored for the status bar and for tests. */
export type PreviewStatus = {
  file: string;
  status: "loading" | "mounted" | "error";
  errors: string[];
  /** Visible text of the rendered component. */
  text: string;
};

/** What the panel is showing and what it knows about it; the props form is built from this. */
export type PanelState = {
  file: string;
  exportName?: string;
  exports: string[];
  props: Record<string, unknown>;
  propsSource: "usage" | "sample" | "given" | "none";
  schema: PropSchema[];
  usages: Usage[];
  usage?: string;
  viewport: keyof typeof VIEWPORTS;
  /** `auto` shows the app as written; `light`/`dark` force the colour scheme (dark class + color-scheme). */
  theme: "auto" | "light" | "dark";
};

export type PreviewApi = {
  status(): PreviewStatus | undefined;
  waitForStatus(matches: (status: PreviewStatus) => boolean, timeoutMs: number): Promise<PreviewStatus>;
  state(): PanelState | undefined;
  /** Re-renders the shown component with these props (what the props form does). */
  setProps(props: Record<string, unknown>): Promise<void>;
  setExport(exportName: string): Promise<void>;
  setUsage(id: string): Promise<void>;
  setViewport(preset: keyof typeof VIEWPORTS): Promise<void>;
  setTheme(theme: PanelState["theme"]): Promise<void>;
  captureBaseline(): Promise<RenderResult>;
  compareChanges(): Promise<DiffResult>;
};

const PREVIEWABLE = /\.(tsx|jsx|vue|svelte)$/;
/** Typing pause before the preview re-renders; short enough to feel live, long enough to batch keystrokes. */
const TYPING_DEBOUNCE_MS = 30;

export function activate(context: vscode.ExtensionContext): PreviewApi {
  const panel = new PreviewPanel();
  context.subscriptions.push(
    vscode.commands.registerCommand("componentPreview.open", () => panel.open(vscode.window.activeTextEditor?.document)),
    vscode.window.onDidChangeActiveTextEditor((editor) => editor && panel.follow(editor.document)),
    vscode.workspace.onDidChangeTextDocument((event) => panel.edited(event.document)),
    vscode.workspace.onDidSaveTextDocument((document) => panel.restored(document)),
    vscode.workspace.onDidCloseTextDocument((document) => panel.restored(document)),
    panel,
  );
  return panel.api;
}

export function deactivate() {}

class PreviewPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private servers = new Map<string, Promise<PreviewServer>>();
  private shownRoot: string | undefined;
  private shownGeneration: number | undefined;
  private current: PreviewStatus | undefined;
  private state: PanelState | undefined;
  private statusChanged = new vscode.EventEmitter<PreviewStatus>();
  private renderers = new Map<string, Promise<Renderer>>();
  private indexes = new Map<string, ReturnType<typeof createUsageIndex>>();
  private buffers = new Map<string, string>();
  private baseline: string | undefined;
  private showSequence = 0;
  private pending = new Map<string, NodeJS.Timeout>();

  readonly api: PreviewApi = {
    status: () => this.current,
    state: () => this.state,
    setProps: (props) => this.setProps(props),
    setExport: (exportName) => this.setExport(exportName),
    setUsage: (id) => this.setUsage(id),
    setViewport: (preset) => this.setViewport(preset),
    setTheme: (theme) => this.setTheme(theme),
    captureBaseline: () => this.captureBaseline(),
    compareChanges: () => this.compareChanges(),
    waitForStatus: (matches, timeoutMs) =>
      new Promise((resolve, reject) => {
        if (this.current && matches(this.current)) return resolve(this.current);
        const timer = setTimeout(() => {
          listener.dispose();
          reject(new Error(`Preview status not reached in ${timeoutMs} ms; last: ${JSON.stringify(this.current)}`));
        }, timeoutMs);
        const listener = this.statusChanged.event((status) => {
          if (!matches(status)) return;
          clearTimeout(timer);
          listener.dispose();
          resolve(status);
        });
      }),
  };

  async open(document: vscode.TextDocument | undefined) {
    if (!document || !PREVIEWABLE.test(document.fileName)) {
      vscode.window.showInformationMessage("Open a .tsx, .jsx, .vue or .svelte component file to preview it.");
      return;
    }
    this.panel ??= this.createPanel();
    await this.show(document);
  }

  /** Follow mode: the panel tracks whichever component file is active. */
  follow(document: vscode.TextDocument) {
    if (this.panel && PREVIEWABLE.test(document.fileName) && document.uri.scheme === "file") void this.show(document);
  }

  edited(document: vscode.TextDocument) {
    if (document.uri.scheme !== "file") return;
    const file = document.fileName;
    clearTimeout(this.pending.get(file));
    this.pending.set(
      file,
      setTimeout(async () => {
        this.pending.delete(file);
        const server = this.serverFor(file);
        if (server) { this.buffers.set(file, document.getText()); (await server).updateBuffer(file, document.getText()); }
      }, TYPING_DEBOUNCE_MS),
    );
  }

  /** The file on disk is current again (saved, or closed without saving): drop the unsaved overlay. */
  async restored(document: vscode.TextDocument) {
    if (document.uri.scheme !== "file") return;
    clearTimeout(this.pending.get(document.fileName));
    const server = this.serverFor(document.fileName);
    this.buffers.delete(document.fileName);
    if (server) (await server).updateBuffer(document.fileName, undefined);
  }

  dispose() {
    this.panel?.dispose();
    for (const timer of this.pending.values()) clearTimeout(timer);
    for (const renderer of this.renderers.values()) void renderer.then((r) => r.close());
    for (const server of this.servers.values()) void server.then((s) => s.close());
    this.servers.clear();
  }

  private async show(document: vscode.TextDocument, exportName?: string) {
    const sequence = ++this.showSequence;
    const file = document.fileName;
    const root = projectRoot(file);
    const server = await this.server(root);
    const source = document.getText();
    if (document.isDirty && this.buffers.get(file) !== source) { server.updateBuffer(file, source); this.buffers.set(file, source); }
    let index = this.indexes.get(root);
    if (!index) { index = createUsageIndex(root, { readSource: server.readSource, version: server.version }); this.indexes.set(root, index); }
    const target = await this.targetFor(root, file, source, exportName);
    target.route = await routeFor(root, file, target.exportName, undefined, (f: string, x?: string) => findUsages(root, f, x));
    target.theme = this.forcedTheme();
    const usages = await index.list(file, target.exportName);
    const schema = await propsSchema(file, target.exportName).catch(() => []);
    if (sequence !== this.showSequence || !this.panel) return;
    this.baseline = undefined;
    this.state = {
      file,
      exportName: target.exportName,
      exports: listExports(file, source),
      props: target.props ?? {},
      propsSource: target.propsSource,
      schema, usages, usage: target.propsSource === "usage" ? usages.find((u) => JSON.stringify(u.props) === JSON.stringify(target.props))?.id : undefined,
      viewport: this.state?.viewport ?? "desktop",
      theme: this.state?.theme ?? "auto",
    };
    this.current = { file, status: "loading", errors: [], text: "" };
    const { generation } = await server.prepare(file);
    if (sequence !== this.showSequence || !this.panel) return;
    if (this.shownRoot !== root || this.shownGeneration !== generation) {
      this.shownRoot = root;
      this.shownGeneration = generation;
      const origin = (await vscode.env.asExternalUri(vscode.Uri.parse(server.url))).toString().replace(/\/$/, "");
      this.panel!.webview.html = webviewHtml(origin, `${origin}${server.pageUrl(target)}`);
    } else {
      void this.panel!.webview.postMessage({ type: "show", target });
    }
    void this.panel!.webview.postMessage({ type: "state", state: this.state });
    this.panel!.title = `Preview: ${path.basename(file)}`;
  }

  private async setProps(props: Record<string, unknown>) {
    if (!this.state || !this.panel) return;
    this.baseline = undefined;
    this.state = { ...this.state, props, propsSource: "given", usage: undefined };
    const target: PreviewTarget = { file: this.state.file, exportName: this.state.exportName, props, fresh: false, theme: this.forcedTheme() };
    void this.panel.webview.postMessage({ type: "show", target });
    void this.panel.webview.postMessage({ type: "state", state: this.state });
  }

  private async setExport(exportName: string) {
    if (!this.state) return;
    const document = await vscode.workspace.openTextDocument(this.state.file);
    await this.show(document, exportName);
  }

  /**
   * Real props first: the first place the project uses one of the file's exports. With no usage, samples from
   * the TypeScript type, so a brand-new component still renders.
   */
  private async targetFor(root: string, file: string, source: string, requested?: string): Promise<PreviewTarget & { propsSource: PanelState["propsSource"] }> {
    const preferred = requested ?? pickExport(file, source);
    const candidates = requested ? [requested] : [preferred, ...listExports(file, source)].filter((n, i, all): n is string => !!n && all.indexOf(n) === i);
    for (const exportName of candidates) {
      const usage = (await this.indexes.get(root)!.list(file, exportName)).find((u) => Object.keys(u.props).length);
      if (usage) return { file, exportName, props: usage.props, propsSource: "usage" };
    }
    const sample = sampleProps(await propsSchema(file, preferred).catch(() => []));
    if (Object.keys(sample).length) return { file, exportName: preferred, props: sample, propsSource: "sample" };
    return { file, exportName: preferred, propsSource: "none" };
  }

  private async setUsage(id: string) {
    const usage = this.state?.usages.find((u) => u.id === id);
    if (!usage || !this.state || !this.panel) throw new Error(`Unknown usage "${id}"`);
    this.baseline = undefined;
    this.state = { ...this.state, usage: id, props: usage.props, propsSource: "usage" };
    await this.panel.webview.postMessage({ type: "show", target: { file: this.state.file, exportName: this.state.exportName, props: usage.props, fresh: true, theme: this.forcedTheme() } });
    await this.panel.webview.postMessage({ type: "state", state: this.state });
  }

  /** The theme the preview forces, or none when the toolbar says `auto`. */
  private forcedTheme(): PreviewTarget["theme"] {
    return this.state?.theme === "light" || this.state?.theme === "dark" ? this.state.theme : undefined;
  }

  private async setTheme(theme: PanelState["theme"]) {
    if (!["auto", "light", "dark"].includes(theme)) throw new Error(`Unknown theme "${theme}"`);
    if (!this.state || !this.panel) return;
    this.baseline = undefined;
    this.state = { ...this.state, theme };
    // `auto` after a forced theme reloads the page, since the app's own <html> class is only known at load.
    const target: PreviewTarget = { file: this.state.file, exportName: this.state.exportName, props: this.state.props, fresh: false, theme: this.forcedTheme() };
    await this.panel.webview.postMessage({ type: "show", target });
    await this.panel.webview.postMessage({ type: "state", state: this.state });
  }

  private async setViewport(preset: keyof typeof VIEWPORTS) {
    if (!(preset in VIEWPORTS)) throw new Error(`Unknown viewport "${preset}"`);
    if (!this.state || !this.panel) return;
    this.baseline = undefined;
    this.state = { ...this.state, viewport: preset };
    await this.panel.webview.postMessage({ type: "state", state: this.state });
  }

  private async verificationRenderer(): Promise<Renderer> {
    if (!this.shownRoot) throw new Error("Open a preview first.");
    const root = this.shownRoot;
    const server = await this.server(root);
    for (const document of vscode.workspace.textDocuments) {
      if (document.isDirty && document.fileName.startsWith(root + path.sep) && this.buffers.get(document.fileName) !== document.getText()) {
        clearTimeout(this.pending.get(document.fileName));
        server.updateBuffer(document.fileName, document.getText());
        this.buffers.set(document.fileName, document.getText());
      }
    }
    let renderer = this.renderers.get(root);
    if (!renderer) {
      renderer = import("../agent/createRenderer.js").then((m) => m.createRenderer({ root, server }));
      this.renderers.set(root, renderer);
      void renderer.catch(() => this.renderers.delete(root));
    }
    return renderer;
  }

  private async captureBaseline(): Promise<RenderResult> {
    if (!this.state) throw new Error("Open a preview first.");
    const renderer = await this.verificationRenderer();
    const result = await renderer.render({ file: this.state.file, exportName: this.state.exportName, props: this.state.props, usage: this.state.usage, viewport: VIEWPORTS[this.state.viewport], theme: this.forcedTheme() });
    this.baseline = result.captureId;
    await this.panel?.webview.postMessage({ type: "verification", message: result.captureId ? "Baseline captured" + (result.warnings.length ? ": " + result.warnings.join("; ") : ".") : result.errors.join("\n"), baseline: !!this.baseline });
    return result;
  }

  private async compareChanges(): Promise<DiffResult> {
    if (!this.baseline) throw new Error("Capture a baseline before comparing changes.");
    const renderer = await this.verificationRenderer();
    const result = await renderer.diff(this.baseline);
    await this.panel?.webview.postMessage({ type: "verification", evidence: diffEvidence(result), images: [result.before.png, result.after.png, result.diffPng].map((png) => "data:image/png;base64," + png.toString("base64")), baseline: true });
    return result;
  }

  private createPanel(): vscode.WebviewPanel {
    // Keeps the cursor in the file being edited: the preview is for watching while typing.
    const panel = vscode.window.createWebviewPanel("componentPreview", "Arguseye", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    panel.webview.onDidReceiveMessage((message: any) => {
      if (message.type === "ready" && this.state) return void panel.webview.postMessage({ type: "state", state: this.state });
      const act = (work: Promise<unknown>) => void work.catch((error) => panel.webview.postMessage({ type: "verification", message: String(error.message ?? error), baseline: !!this.baseline }));
      if (message.type === "usage") return act(this.setUsage(message.id));
      if (message.type === "viewport") return act(this.setViewport(message.preset));
      if (message.type === "theme") return act(this.setTheme(message.theme));
      if (message.type === "capture") return act(this.captureBaseline());
      if (message.type === "compare") return act(this.compareChanges());
      if (message.type === "props") return void this.setProps(message.props);
      if (message.type === "export") return void this.setExport(message.exportName);
      if (message.source !== "arguseye") return;
      this.current = { file: message.file, status: message.status, errors: message.errors, text: message.text };
      this.statusChanged.fire(this.current);
    });
    panel.onDidDispose(() => {
      this.panel = undefined;
      this.shownRoot = undefined;
      this.shownGeneration = undefined;
    });
    return panel;
  }

  private server(root: string): Promise<PreviewServer> {
    let server = this.servers.get(root);
    if (!server) {
      server = import("../server/createPreviewServer.js").then((m) => m.createPreviewServer({ root }));
      this.servers.set(root, server);
    }
    return server;
  }

  private serverFor(file: string): Promise<PreviewServer> | undefined {
    for (const [root, server] of this.servers) if (file.startsWith(root + path.sep)) return server;
    return undefined;
  }
}

/** The nearest ancestor with a package.json: where node_modules, tsconfig and the app's layout live. */
function projectRoot(file: string): string {
  let dir = path.dirname(file);
  while (!existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  return dir;
}

function webviewHtml(origin: string, pageUrl: string): string {
  const nonce = Math.random().toString(36).slice(2);
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src data:;">
<style nonce="${nonce}">
  html, body { margin: 0; height: 100%; font: 12px var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  body { display: flex; flex-direction: column; }
  #bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 4px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
  #bar select, #bar button { font: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; padding: 2px 4px; }
  #bar .spacer { flex: 1; }
  #bar .source { opacity: .7; }
  #main { display: flex; flex: 1; min-height: 0; }
  #stage { flex: 1; overflow: auto; min-width: 0; position: relative; background: var(--vscode-editorWidget-background, #1e1e1e); }
  /* The preview keeps its real viewport size and is scaled to fit the panel; 1:1 shows it unscaled. */
  #frameBox { position: relative; margin: 12px auto; box-shadow: 0 8px 30px rgba(0,0,0,.35); border-radius: 8px; overflow: hidden; }
  iframe { display: block; border: 0; background: #fff; width: 1280px; height: 800px; transform-origin: top left; }
  #status { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  #status.error { background: var(--vscode-errorForeground); color: #fff; }
  #bar .group { display: inline-flex; gap: 4px; align-items: center; }
  #bar button.on { outline: 1px solid var(--vscode-focusBorder); }
  #verification { padding: 8px; border-top: 1px solid var(--vscode-panel-border); max-height: 45%; overflow: auto; }
  #verification:empty { display: none; }
  #verification .images { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  #verification figure { margin: 0; } #verification img { width: 100%; height: auto; } #verification figcaption { padding: 4px 0; }
  button:focus-visible, select:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
  #props { width: 240px; overflow: auto; border-left: 1px solid var(--vscode-panel-border); padding: 8px; display: none; }
  #props.open { display: block; }
  #props label { display: block; margin: 6px 0 2px; opacity: .85; }
  #props label b { color: var(--vscode-errorForeground); }
  #props input, #props select, #props textarea { width: 100%; box-sizing: border-box; font: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; padding: 3px 4px; }
  #props input[type=checkbox] { width: auto; }
  #props textarea { font-family: var(--vscode-editor-font-family); min-height: 48px; }
  #props .doc { opacity: .6; font-size: 11px; }
  #props .empty { opacity: .6; }
</style>
</head><body>
<div id="bar">
  <select id="export" title="Export" aria-label="Component export"></select>
  <select id="usage" title="Usage" aria-label="Component usage"></select>
  <select id="viewport" aria-label="Viewport"><option value="mobile">Mobile · 390</option><option value="tablet">Tablet · 820</option><option value="desktop" selected>Desktop · 1280</option></select>
  <select id="theme" aria-label="Theme" title="Force light or dark (the dark class and color-scheme on html)"><option value="auto" selected>Theme · app</option><option value="light">Light</option><option value="dark">Dark</option></select>
  <span class="source" id="source"></span>
  <span class="spacer"></span>
  <span id="status" title="Render status">loading</span>
  <span class="group"><button id="fit" class="on" title="Scale the preview to fit the panel">Fit</button><button id="full" title="Show at the real size">1:1</button></span>
  <span class="group"><button id="capture">Capture Baseline</button><button id="compare" disabled>Compare Changes</button></span>
  <button id="toggle" title="Edit props">Props</button>
</div>
<div id="main">
  <div id="stage"><div id="frameBox"><iframe id="preview" title="Component preview" src="${pageUrl}" allow="clipboard-read; clipboard-write"></iframe></div></div>
  <div id="props"></div>
</div>
<div id="verification" role="status" aria-live="polite"></div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const frame = document.getElementById("preview");
const stage = document.getElementById("stage"), frameBox = document.getElementById("frameBox"), statusChip = document.getElementById("status");
let fitMode = true;
/** Scales the real-size iframe to the panel width (or 1:1), so wide viewports stay readable in a narrow panel. */
function layout() {
  const vw = frame.offsetWidth || 1280, vh = frame.offsetHeight || 800;
  const available = stage.clientWidth - 24;
  const scale = fitMode ? Math.min(1, available / vw) : 1;
  frame.style.transform = "scale(" + scale + ")";
  frameBox.style.width = Math.round(vw * scale) + "px";
  frameBox.style.height = Math.round(vh * scale) + "px";
}
new ResizeObserver(layout).observe(stage);
new ResizeObserver(layout).observe(frame);
document.getElementById("fit").onclick = () => { fitMode = true; document.getElementById("fit").classList.add("on"); document.getElementById("full").classList.remove("on"); layout(); };
document.getElementById("full").onclick = () => { fitMode = false; document.getElementById("full").classList.add("on"); document.getElementById("fit").classList.remove("on"); layout(); };
const form = document.getElementById("props");
const exportSelect = document.getElementById("export");
let state;
vscode.postMessage({ type: "ready" });

addEventListener("message", (event) => {
  const data = event.data;
  if (event.source === frame.contentWindow && data?.source === "arguseye") {
    vscode.postMessage(data);        // from the preview page
    statusChip.textContent = data.status === "error" ? (data.errors?.length ?? 1) + " error" + ((data.errors?.length ?? 1) === 1 ? "" : "s") : data.status === "mounted" ? "rendered" : data.status;
    statusChip.className = data.status === "error" ? "error" : "";
  }
  else if (data?.type === "show") frame.contentWindow.postMessage({ type: "cp:show", target: data.target }, "*");
  else if (data?.type === "verification") {
    const host = document.getElementById("verification"); host.replaceChildren();
    document.getElementById("compare").disabled = !data.baseline;
    const summary = document.createElement("p");
    summary.textContent = data.message ?? (data.evidence.status + ": " + data.evidence.changedPercent.toFixed(2) + "% changed pixels. " + (data.evidence.snapshotChanged ? "Accessibility tree changed. " : "") + data.evidence.after.warnings.join("; ") + data.evidence.newErrors.join("; "));
    host.append(summary);
    if (data.images) {
      const grid = document.createElement("div"); grid.className = "images";
      data.images.forEach((src, i) => { const figure = document.createElement("figure"), caption = document.createElement("figcaption"), img = document.createElement("img"); caption.textContent = ["Before", "After", "Changed pixels"][i]; img.alt = caption.textContent; img.src = src; figure.append(caption, img); grid.append(figure); });
      host.append(grid);
    }
  }
  else if (data?.type === "state") { state = data.state; renderBar(); renderForm(); }
});
document.getElementById("toggle").onclick = () => form.classList.toggle("open");
document.getElementById("usage").onchange = (event) => { if (event.target.value) vscode.postMessage({ type: "usage", id: event.target.value }); };
document.getElementById("viewport").onchange = (event) => vscode.postMessage({ type: "viewport", preset: event.target.value });
document.getElementById("theme").onchange = (event) => vscode.postMessage({ type: "theme", theme: event.target.value });
document.getElementById("capture").onclick = () => vscode.postMessage({ type: "capture" });
document.getElementById("compare").onclick = () => vscode.postMessage({ type: "compare" });
exportSelect.onchange = () => vscode.postMessage({ type: "export", exportName: exportSelect.value });

function renderBar() {
  const usageSelect = document.getElementById("usage"); usageSelect.replaceChildren();
  const custom = document.createElement("option"); custom.value = ""; custom.textContent = "Custom props"; usageSelect.append(custom);
  for (const usage of state.usages) { const option = document.createElement("option"); option.value = usage.id; option.textContent = usage.id + (usage.unresolved.length ? " (runtime inputs)" : ""); option.selected = usage.id === state.usage; usageSelect.append(option); }
  document.getElementById("viewport").value = state.viewport;
  document.getElementById("theme").value = state.theme ?? "auto";
  const sizes = { mobile: [390, 844], tablet: [820, 1180], desktop: [1280, 800] };
  frame.width = sizes[state.viewport][0]; frame.height = sizes[state.viewport][1];
  frame.style.width = frame.width + "px"; frame.style.height = frame.height + "px";
  document.getElementById("compare").disabled = true;
  document.getElementById("verification").replaceChildren();
  exportSelect.innerHTML = state.exports.map((n) => \`<option \${n === state.exportName ? "selected" : ""}>\${n}</option>\`).join("");
  document.getElementById("source").textContent = { usage: "props from a real usage", sample: "sample props from the type", given: "edited props", none: "" }[state.propsSource];
}

/** One control per prop, by kind; function props are not editable from here. */
function renderForm() {
  form.innerHTML = "";
  if (!state.schema.length) { form.innerHTML = '<div class="empty">No typed props found.</div>'; return; }
  for (const prop of state.schema) {
    const value = state.props[prop.name] ?? prop.default;
    const label = document.createElement("label");
    label.innerHTML = \`\${prop.name}\${prop.required ? "<b>*</b>" : ""} <span class="doc">\${prop.kind}\${prop.description ? " · " + prop.description : ""}</span>\`;
    form.append(label);
    let control;
    if (prop.kind === "function") { control = document.createElement("div"); control.className = "doc"; control.textContent = "not editable"; }
    else if (prop.kind === "boolean") { control = document.createElement("input"); control.type = "checkbox"; control.checked = Boolean(value); }
    else if (prop.kind === "number") { control = document.createElement("input"); control.type = "number"; control.step = "any"; control.value = value ?? ""; }
    else if (prop.kind === "enum") { control = document.createElement("select"); control.innerHTML = prop.options.map((o) => \`<option value=\${JSON.stringify(String(o))} \${o === value ? "selected" : ""}>\${o}</option>\`).join(""); }
    else if (prop.kind === "string" || prop.kind === "node") { control = document.createElement("input"); control.type = "text"; control.value = value ?? ""; }
    else { control = document.createElement("textarea"); control.value = value === undefined ? "" : JSON.stringify(value, null, 1); }
    control.dataset.prop = prop.name; control.dataset.kind = prop.kind;
    control.addEventListener("input", schedule);
    form.append(control);
  }
}

let timer;
function schedule() { clearTimeout(timer); timer = setTimeout(submit, 150); }
function submit() {
  const props = { ...state.props };
  for (const el of form.querySelectorAll("[data-prop]")) {
    const name = el.dataset.prop, kind = el.dataset.kind;
    if (kind === "function") continue;
    if (kind === "boolean") props[name] = el.checked;
    else if (kind === "number") { if (el.value === "") delete props[name]; else props[name] = Number(el.value); }
    else if (kind === "enum") { const opt = state.schema.find((p) => p.name === name).options.find((o) => String(o) === el.value); props[name] = opt; }
    else if (kind === "string" || kind === "node") { if (el.value === "") delete props[name]; else props[name] = el.value; }
    else { if (el.value.trim() === "") delete props[name]; else try { props[name] = JSON.parse(el.value); } catch { continue; } }
  }
  vscode.postMessage({ type: "props", props });
}
</script>
</body></html>`;
}
