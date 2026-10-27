import http from "node:http";
import type { AddressInfo } from "node:net";
import { ModuleGraph, readFromDisk } from "./moduleGraph.js";
import { DepBundler } from "./depBundler.js";

export type PreviewServerOptions = {
  root: string;
};

export type PreviewServer = {
  url: string;
  moduleUrl(file: string): string;
  close(): Promise<void>;
};

export async function createPreviewServer(options: PreviewServerOptions): Promise<PreviewServer> {
  const deps = new DepBundler(options.root);
  const graph = new ModuleGraph(readFromDisk, deps);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    try {
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
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}

function send(res: http.ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-cache" });
  res.end(body);
}
