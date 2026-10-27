import * as vscode from "vscode";
import { existsSync } from "node:fs";
import path from "node:path";
import type { PreviewServer } from "../server/createPreviewServer.js";
import type { PreviewTarget } from "../server/page.js";
import { listExports, pickExport } from "../project/pickExport.js";
import { findUsages } from "../usages/findUsages.js";
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
};

export type PreviewApi = {
  status(): PreviewStatus | undefined;
  waitForStatus(matches: (status: PreviewStatus) => boolean, timeoutMs: number): Promise<PreviewStatus>;
  state(): PanelState | undefined;
  /** Re-renders the shown component with these props (what the props form does). */
  setProps(props: Record<string, unknown>): Promise<void>;
  setExport(exportName: string): Promise<void>;
};

const PREVIEWABLE = /\.(tsx|jsx|vue)$/;
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
  private pending = new Map<string, NodeJS.Timeout>();

  readonly api: PreviewApi = {
    status: () => this.current,
    state: () => this.state,
    setProps: (props) => this.setProps(props),
    setExport: (exportName) => this.setExport(exportName),
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
      vscode.window.showInformationMessage("Open a .tsx, .jsx or .vue component file to preview it.");
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
        if (server) (await server).updateBuffer(file, document.getText());
      }, TYPING_DEBOUNCE_MS),
    );
  }

  /** The file on disk is current again (saved, or closed without saving): drop the unsaved overlay. */
  async restored(document: vscode.TextDocument) {
    if (document.uri.scheme !== "file") return;
    clearTimeout(this.pending.get(document.fileName));
    const server = this.serverFor(document.fileName);
    if (server) (await server).updateBuffer(document.fileName, undefined);
  }

  dispose() {
    this.panel?.dispose();
    for (const server of this.servers.values()) void server.then((s) => s.close());
    this.servers.clear();
  }

  private async show(document: vscode.TextDocument, exportName?: string) {
    const file = document.fileName;
    const root = projectRoot(file);
    const server = await this.server(root);
    const source = document.getText();
    const target = await this.targetFor(root, file, source, exportName);
    this.state = {
      file,
      exportName: target.exportName,
      exports: listExports(file, source),
      props: target.props ?? {},
      propsSource: target.propsSource,
      schema: await propsSchema(file, target.exportName).catch(() => []),
    };
    this.current = { file, status: "loading", errors: [], text: "" };
    const { generation } = await server.prepare(file);
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
    this.state = { ...this.state, props, propsSource: "given" };
    const target: PreviewTarget = { file: this.state.file, exportName: this.state.exportName, props, fresh: false };
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
      const usage = (await findUsages(root, file, exportName)).find((u) => Object.keys(u.props).length);
      if (usage) return { file, exportName, props: usage.props, propsSource: "usage" };
    }
    const sample = sampleProps(await propsSchema(file, preferred).catch(() => []));
    if (Object.keys(sample).length) return { file, exportName: preferred, props: sample, propsSource: "sample" };
    return { file, exportName: preferred, propsSource: "none" };
  }

  private createPanel(): vscode.WebviewPanel {
    // Keeps the cursor in the file being edited: the preview is for watching while typing.
    const panel = vscode.window.createWebviewPanel("componentPreview", "Component Preview", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    panel.webview.onDidReceiveMessage((message: any) => {
      if (message.type === "props") return void this.setProps(message.props);
      if (message.type === "export") return void this.setExport(message.exportName);
      if (message.source !== "component-preview") return;
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
<style nonce="${nonce}">
  html, body { margin: 0; height: 100%; font: 12px var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  body { display: flex; flex-direction: column; }
  #bar { display: flex; gap: 8px; align-items: center; padding: 4px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
  #bar select, #bar button { font: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; padding: 2px 4px; }
  #bar .source { opacity: .7; }
  #main { display: flex; flex: 1; min-height: 0; }
  iframe { flex: 1; border: 0; background: #fff; }
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
  <select id="export" title="Export"></select>
  <span class="source" id="source"></span>
  <span style="flex:1"></span>
  <button id="toggle" title="Edit props">Props</button>
</div>
<div id="main">
  <iframe id="preview" src="${pageUrl}" allow="clipboard-read; clipboard-write"></iframe>
  <div id="props"></div>
</div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const frame = document.getElementById("preview");
const form = document.getElementById("props");
const exportSelect = document.getElementById("export");
let state;

addEventListener("message", (event) => {
  const data = event.data;
  if (data?.source === "component-preview") vscode.postMessage(data);        // from the preview page
  else if (data?.type === "show") frame.contentWindow.postMessage({ type: "cp:show", target: data.target }, "*");
  else if (data?.type === "state") { state = data.state; renderBar(); renderForm(); }
});
document.getElementById("toggle").onclick = () => form.classList.toggle("open");
exportSelect.onchange = () => vscode.postMessage({ type: "export", exportName: exportSelect.value });

function renderBar() {
  exportSelect.innerHTML = state.exports.map((n) => \`<option \${n === state.exportName ? "selected" : ""}>\${n}</option>\`).join("");
  document.getElementById("source").textContent = { usage: "props from a real usage", sample: "sample props from the type", given: "edited props", none: "" }[state.propsSource];
  if (state.schema.length && !form.childElementCount) form.classList.add("open");
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
