import http from "node:http";
import type { AddressInfo } from "node:net";
import { ModuleGraph, readFromDisk } from "./moduleGraph.js";
import { DepBundler } from "./depBundler.js";
import { decodeTarget, encodeTarget, previewHtml, reactRuntime, refreshSetup, type PreviewTarget } from "./page.js";

export type PreviewServerOptions = {
  root: string;
};

export type PreviewServer = {
  url: string;
  moduleUrl(file: string): string;
  /** URL of a page that renders `target` and reports `window.__CP__.status`. */
  pageUrl(target: PreviewTarget): string;
  /** Sets a file's unsaved contents (`undefined` = back to disk) and pushes the change to open pages. */
  updateBuffer(file: string, text: string | undefined): Update;
  close(): Promise<void>;
};

/** Pushed to open pages: `css` re-applies a stylesheet, `refresh` hot-swaps components, `reload` re-runs the graph. */
export type Update = {
  kind: "css" | "refresh" | "reload";
  file: string;
  epoch: number;
  versions: Record<string, number>;
};

export async function createPreviewServer(options: PreviewServerOptions): Promise<PreviewServer> {
  const overlay = new Map<string, string>();
  const versions: Record<string, number> = {};
  let epoch = 0;
  const query = (file: string) => `?e=${epoch}${versions[file] ? `&v=${versions[file]}` : ""}`;
  const deps = new DepBundler(options.root);
  const graph = new ModuleGraph(async (file) => overlay.get(file) ?? readFromDisk(file), deps, query);
  const listeners = new Set<http.ServerResponse>();

  function updateBuffer(file: string, text: string | undefined): Update {
    if (text === undefined) overlay.delete(file);
    else overlay.set(file, text);
    versions[file] = (versions[file] ?? 0) + 1;
    const kind = file.endsWith(".css") ? "css" : graph.isRefreshBoundary(file) ? "refresh" : "reload";
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
        const state = { epoch, versions };
        return send(res, 200, "text/html", previewHtml(decodeTarget(url.searchParams.get("t") ?? ""), state));
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
      if (url.pathname.startsWith("/@fs/")) {
        const file = decodeURIComponent(url.pathname.slice("/@fs".length));
        return send(res, 200, "text/javascript", await graph.load(file));
      }
      if (url.pathname.startsWith("/@deps/")) {
        const code = await deps.get(decodeURIComponent(url.pathname.slice("/@deps/".length)));
        if (code !== undefined) return send(res, 200, "text/javascript", code);
      }
      send(res, 404, "text/plain", "not found");
    } catch (err) {
      send(res, 500, "text/plain", String((err as Error).stack ?? err));
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    moduleUrl: (file) => `/@fs${file}`,
    pageUrl: (target) => `/?t=${encodeTarget(target)}`,
    updateBuffer,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}

function send(res: http.ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-cache" });
  res.end(body);
}
