import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { ModuleGraph, readFromDisk } from "./moduleGraph.js";
import { DepBundler } from "./depBundler.js";
import { CssPipeline, isStylesheet } from "./cssPipeline.js";
import { contentType } from "./assets.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { detectAppContext } from "../project/appContext.js";
import { decodeTarget, encodeTarget, previewHtml, reactRuntime, refreshSetup, type PreviewTarget } from "./page.js";

export type PreviewServerOptions = {
  root: string;
};

export type PreviewServer = {
  url: string;
  moduleUrl(file: string): string;
  /** URL of a page that renders `target` and reports `window.__CP__.status`. `live: false` skips pushed updates. */
  pageUrl(target: PreviewTarget, options?: { live?: boolean }): string;
  /** Picks up files changed on disk since they were served (e.g. saved by an agent) and returns the version state. */
  syncDisk(): VersionState;
  /** Errors from serving modules (transform, resolve, bundling) since `since` (ms epoch), newest last. */
  errorsSince(since: number): ServeError[];
  /** Sets a file's unsaved contents (`undefined` = back to disk) and pushes the change to open pages. */
  updateBuffer(file: string, text: string | undefined): Update;
  close(): Promise<void>;
};

/** Pushed to open pages: `css` re-applies a stylesheet, `refresh` hot-swaps components, `reload` re-runs the graph. */
export type VersionState = { epoch: number; versions: Record<string, number> };

export type Update = VersionState & { kind: "css" | "refresh" | "reload"; file: string };

/** A module the server could not produce; the browser only sees "failed to fetch", so this is kept for it. */
export type ServeError = { url: string; message: string; at: number };
const MAX_SERVE_ERRORS = 50;

export async function createPreviewServer(options: PreviewServerOptions): Promise<PreviewServer> {
  const overlay = new Map<string, string>();
  const versions: Record<string, number> = {};
  let epoch = 0;
  const query = (file: string) => `?e=${epoch}${versions[file] ? `&v=${versions[file]}` : ""}`;
  const deps = new DepBundler(options.root);
  /** mtime of each file as last served from disk, to spot edits made outside the editor. */
  const servedMtimes = new Map<string, number>();
  const readSource = async (file: string) => {
    const buffered = overlay.get(file);
    if (buffered !== undefined) return buffered;
    servedMtimes.set(file, statSync(file).mtimeMs);
    return readFromDisk(file);
  };
  const css = new CssPipeline(options.root);
  const graph = new ModuleGraph(readSource, deps, query, css, options.root);
  const listeners = new Set<http.ServerResponse>();
  const serveErrors: ServeError[] = [];
  const errorsSince = (since: number) => serveErrors.filter((e) => e.at >= since);

  function updateBuffer(file: string, text: string | undefined): Update {
    if (text === undefined) overlay.delete(file);
    else overlay.set(file, text);
    if (!isStylesheet(file)) {
      // New utility classes in the edit: re-send the Tailwind sheets first so styles land with the markup.
      const content = text ?? readFileSync(file, "utf8");
      for (const sheet of css.sourceChanged(file, content)) changed(sheet);
    }
    return changed(file);
  }

  function syncDisk(): VersionState {
    for (const [file, mtime] of servedMtimes) {
      if (overlay.has(file)) continue;
      const now = statSync(file, { throwIfNoEntry: false })?.mtimeMs;
      if (now !== mtime) {
        servedMtimes.delete(file);
        if (now !== undefined && !isStylesheet(file)) {
          for (const sheet of css.sourceChanged(file, readFileSync(file, "utf8"))) changed(sheet);
        }
        changed(file);
      }
    }
    return { epoch, versions: { ...versions } };
  }

  function changed(file: string): Update {
    versions[file] = (versions[file] ?? 0) + 1;
    const kind = isStylesheet(file) ? "css" : graph.isRefreshBoundary(file) ? "refresh" : "reload";
    if (kind === "reload") epoch++;
    const update: Update = { kind, file, epoch, versions: { ...versions } };
    const message = `data: ${JSON.stringify(update)}\n\n`;
    for (const res of listeners) res.write(message);
    return update;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    try {
      if (url.pathname === "/") {
        const state = { epoch, versions, live: url.searchParams.get("live") !== "0" };
        const app = detectAppContext(options.root);
        const globalCssUrls = app.globalCss.map((file) => `/@fs${file}?import&${query(file).slice(1)}`);
        const target = decodeTarget(url.searchParams.get("t") ?? "");
        return send(res, 200, "text/html", previewHtml(target, { state, globalCssUrls, htmlClass: app.htmlClass, bodyClass: app.bodyClass }));
      }
      if (url.pathname === "/@errors") {
        return send(res, 200, "application/json", JSON.stringify(errorsSince(Number(url.searchParams.get("since") ?? 0))));
      }
      if (url.pathname === "/@events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
        res.write(": connected\n\n");
        listeners.add(res);
        req.on("close", () => listeners.delete(res));
        return;
      }
      if (url.pathname === "/@refresh-setup") {
        deps.add("react-refresh/runtime");
        return send(res, 200, "text/javascript", refreshSetup);
      }
      if (url.pathname === "/@runtime") {
        ["react", "react-dom", "react-dom/client"].forEach((d) => deps.add(d));
        return send(res, 200, "text/javascript", reactRuntime);
      }
      if (url.pathname.startsWith("/@fs/") && url.searchParams.has("raw")) {
        const file = decodeURIComponent(url.pathname.slice("/@fs".length));
        return sendFile(res, file);
      }
      if (url.pathname.startsWith("/@fs/")) {
        const file = decodeURIComponent(url.pathname.slice("/@fs".length));
        return send(res, 200, "text/javascript", await graph.load(file));
      }
      if (url.pathname.startsWith("/@deps/")) {
        const code = await deps.get(decodeURIComponent(url.pathname.slice("/@deps/".length)));
        if (code !== undefined) return send(res, 200, "text/javascript", code);
      }
      // Anything else is a public/ asset referenced by absolute path, as the app's server would serve it.
      const publicFile = path.join(options.root, "public", path.normalize(decodeURIComponent(url.pathname)));
      if (publicFile.startsWith(path.join(options.root, "public")) && existsSync(publicFile)) return sendFile(res, publicFile);
      send(res, 404, "text/plain", "not found");
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      serveErrors.push({ url: req.url ?? "", message, at: Date.now() });
      if (serveErrors.length > MAX_SERVE_ERRORS) serveErrors.shift();
      send(res, 500, "text/plain", message);
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    moduleUrl: (file) => `/@fs${file}`,
    pageUrl: (target, { live = true } = {}) => `/?t=${encodeTarget(target)}${live ? "" : "&live=0"}`,
    updateBuffer,
    syncDisk,
    errorsSince,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}

function sendFile(res: http.ServerResponse, file: string) {
  res.writeHead(200, { "content-type": contentType(file), "cache-control": "no-cache" });
  res.end(readFileSync(file));
}

function send(res: http.ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-cache" });
  res.end(body);
}
