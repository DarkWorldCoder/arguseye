import * as vscode from "vscode";
import { existsSync } from "node:fs";
import path from "node:path";
import type { PreviewServer } from "../server/createPreviewServer.js";
import type { PreviewTarget } from "../server/page.js";
import { listExports, pickExport } from "../project/pickExport.js";
import { findUsages } from "../usages/findUsages.js";

/** What the preview page last reported, mirrored for the status bar and for tests. */
export type PreviewStatus = {
  file: string;
  status: "loading" | "mounted" | "error";
  errors: string[];
  /** Visible text of the rendered component. */
  text: string;
};

export type PreviewApi = {
  status(): PreviewStatus | undefined;
  waitForStatus(matches: (status: PreviewStatus) => boolean, timeoutMs: number): Promise<PreviewStatus>;
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
  private statusChanged = new vscode.EventEmitter<PreviewStatus>();
  private pending = new Map<string, NodeJS.Timeout>();

  readonly api: PreviewApi = {
    status: () => this.current,
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

  private async show(document: vscode.TextDocument) {
    const file = document.fileName;
    const root = projectRoot(file);
    const server = await this.server(root);
    const target = await this.targetFor(root, file, document.getText());
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
    this.panel!.title = `Preview: ${path.basename(file)}`;
  }

  /** Real props: the first place the project uses one of the file's exports, so it shows as it does in the app. */
  private async targetFor(root: string, file: string, source: string): Promise<PreviewTarget> {
    const preferred = pickExport(file, source);
    const candidates = [preferred, ...listExports(file, source)].filter((n, i, all): n is string => !!n && all.indexOf(n) === i);
    for (const exportName of candidates) {
      const usage = (await findUsages(root, file, exportName)).find((u) => Object.keys(u.props).length);
      if (usage) return { file, exportName, props: usage.props };
    }
    return { file, exportName: preferred };
  }

  private createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel("componentPreview", "Component Preview", vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    panel.webview.onDidReceiveMessage((message: PreviewStatus & { source?: string }) => {
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
<style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#fff}</style>
</head><body>
<iframe id="preview" src="${pageUrl}" allow="clipboard-read; clipboard-write"></iframe>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const frame = document.getElementById("preview");
addEventListener("message", (event) => {
  // From the preview page: status reports. From the extension: commands for the page.
  if (event.data?.source === "component-preview") vscode.postMessage(event.data);
  else if (event.data?.type === "show") frame.contentWindow.postMessage({ type: "cp:show", target: event.data.target }, "*");
});
</script>
</body></html>`;
}
