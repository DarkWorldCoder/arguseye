import { fileUrl, fileFromUrl } from "./fileUrl.js";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { mkdtempSync, readFileSync, statSync, existsSync, rmSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { AddressInfo } from "node:net";
import type { ViteDevServer } from "vite";
import { createResolver } from "./resolver.js";
import { createFileAccess, FileAccessError } from "./createFileAccess.js";
import { detectAppContext, wrapperModule, type Wrapper } from "../project/appContext.js";
import { previewSetup } from "../project/previewSetup.js";
import { vueEntry, vueSetupModule } from "../project/vueSetup.js";
import { autoComponentsModule, readAutoComponents } from "../project/autoImports.js";
import { frameworkOf, jsxRuntimeOf } from "../project/framework.js";
import { routerPackage } from "../project/routerPackage.js";
import { publicEnv } from "../project/publicEnv.js";
import { previewHtml, decodeTarget, decodeContext, reactRuntime, refreshSetup, type PreviewTarget } from "./page.js";
import { vueRuntime } from "./vueRuntime.js";
import { svelteRuntime } from "./svelteRuntime.js";
import { preactRuntime } from "./preactRuntime.js";
import { solidRuntime } from "./solidRuntime.js";
import type { PreviewServerOptions, Update, ServeError } from "./createPreviewServer.js";

/** Executes the project's real Vite pipeline in a process whose cwd and NODE_ENV cannot leak to other projects. */
export async function createViteBackend(options: PreviewServerOptions, notify: (event: any) => void) {
  const root = path.resolve(options.root), resolver = createResolver(), ownRequire = createRequire(import.meta.url);
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  if (!{ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies }.vite) throw new Error(`Vite compatibility requires the selected project to declare its own vite: ${root}`);
  const viteEntry = resolver.resolveFileSync(path.join(root, "package.json"), "vite").path;
  if (!viteEntry) throw new Error(`Vite compatibility requires the project's own installed vite in ${root}; install it there or use native mode.`);
  const { createServer } = await import(pathToFileURL(viteEntry).href);
  const cacheDir = mkdtempSync(path.join(os.tmpdir(), "arguseye-vite-"));
  const runtimeRefresh = ownRequire.resolve("react-refresh/runtime");
  const runtimeDir = path.dirname(runtimeRefresh);
  // A Vite graph serves transitive packages directly instead of inside Arguseye's dependency bundle.
  const packageRoots = dependencyRoots(root, [viteEntry, runtimeRefresh]);
  const access = createFileAccess(root, [...options.allowedRoots ?? [], ...packageRoots, cacheDir, runtimeDir]);
  const overlay = new Map<string, string>(), mtimes = new Map<string, number>();
  const versions: Record<string, number> = {};
  let epoch = 0, generation = 1, lastTarget: PreviewTarget | undefined;
  let vite: ViteDevServer;
  let setup = previewSetup(root);
  const errors: ServeError[] = [], listeners = new Set<http.ServerResponse>();
  const generated = new Map<string, string>();
  const source = (file: string) => {
    access.assert(file);
    const value = overlay.get(file) ?? readFileSync(file, "utf8");
    const mtime = statSync(file, { throwIfNoEntry: false })?.mtimeMs;
    if (mtime !== undefined) mtimes.set(file, mtime);
    notify({ type: "source", file, source: value, mtime });
    return value;
  };
  const app = (route?: string) => {
    if (route) access.assert(route);
    const detected = detectAppContext(root, source, route);
    return setup.jsx ? { ...detected, entry: setup.jsx, wrappers: [{ kind: "component" as const, source: setup.jsx, importName: "default", props: {} }], layouts: [path.relative(root, setup.jsx)] } : detected;
  };
  const globals = () => { const context = app(); return { globalCssUrls: context.globalCss.map((f) => `${fileUrl(f)}?import&e=${epoch}`), htmlClass: context.htmlClass, bodyClass: context.bodyClass }; };
  const register = (file: string, code: string) => { generated.set(slash(file), code); return `${fileUrl(file)}?e=${epoch}`; };
  const runtimeCode = (code: string) => code.replace(/(["'])\/@deps\/(.+?)\.js\1/g, (_match, _q, spec) => JSON.stringify(spec));
  const runtimes = { react: reactRuntime, vue: vueRuntime, svelte: svelteRuntime, preact: preactRuntime, solid: solidRuntime };
  const generatedUrl = (url: URL) => {
    const file = path.join(root, ".arguseye-preview", url.pathname.slice(2).replaceAll("/", "-") + (url.pathname === "/@context" ? "-" + url.searchParams.get("c") : "") + ".js");
    if (url.pathname === "/@runtime") return register(file, runtimeCode(runtimes[(url.searchParams.get("framework") ?? "react") as keyof typeof runtimes] ?? reactRuntime));
    if (url.pathname === "/@refresh-setup") return register(file, runtimeCode(refreshSetup) + '\nwindow.__vite_plugin_react_preamble_installed__ = true;');
    if (url.pathname === "/@wrapper") {
      const context = app(url.searchParams.get("route") ?? undefined);
      const at = context.entry ? context.entry.replace(/\.[^.]+$/, ".arguseye-wrapper.tsx") : file;
      return register(at, wrapperModule(context.wrappers, { css: context.globalCss, router: routerPackage(root), jsx: jsxRuntimeOf(root) }));
    }
    if (url.pathname === "/@context") {
      const { file: from, wrappers } = decodeContext(url.searchParams.get("c") ?? ""); access.assert(from);
      return register(from.replace(/\.[^.]+$/, ".arguseye-context.tsx"), wrapperModule(wrappers, { markInnermost: true, jsx: jsxRuntimeOf(root) }));
    }
    if (url.pathname === "/@svelte-setup") return register(file, setup.svelte ? `export {default} from ${JSON.stringify(setup.svelte)};` : "export default null;");
    if (url.pathname === "/@vue-components") return register(file, autoComponentsModule(readAutoComponents(root)));
    if (url.pathname === "/@vue-setup") {
      if (setup.vue) return register(file, `export { default } from ${JSON.stringify(setup.vue)};`);
      const entry = vueEntry(root), code = entry ? vueSetupModule(entry, source(entry)) : undefined;
      return register(entry ? entry.replace(/\.[^.]+$/, ".arguseye-setup.ts") : file, code ?? "export default null;");
    }
    if (url.pathname === "/@fs/@empty") return register(file, "export default function Empty({children}) { return children ?? null; }");
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const host = new URL(`http://${req.headers.host ?? ""}`);
      if (!["127.0.0.1", "localhost", "[::1]"].includes(host.hostname) || req.headers.origin && req.headers.origin !== host.origin) return send(res, 403, "text/plain", "Unexpected preview host or origin");
      if (!["GET", "HEAD"].includes(req.method ?? "")) return send(res, 405, "text/plain", "Preview requests must use GET or HEAD");
      if (url.pathname === "/") {
        const target = decodeTarget(url.searchParams.get("t") ?? "");
        if (target.file !== "/@empty") access.assert(target.file);
        const html = previewHtml(target, { state: { epoch, versions, live: url.searchParams.get("live") !== "0" }, jsx: jsxRuntimeOf(root), env: publicEnv(root), ...globals() });
        return send(res, 200, "text/html", await vite.transformIndexHtml("/", html));
      }
      if (url.pathname === "/@errors") return send(res, 200, "application/json", JSON.stringify(errors.filter((e) => e.at >= Number(url.searchParams.get("since") ?? 0))));
      if (url.pathname === "/@graph") return send(res, 200, "application/json", "[]");
      if (url.pathname === "/@events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" }); res.write(": connected\n\n"); listeners.add(res); req.on("close", () => listeners.delete(res)); return;
      }
      const generated = generatedUrl(url);
      if (generated) {
        const result = await vite.transformRequest(generated);
        if (!result) throw new Error(`Vite did not transform ${url.pathname}`);
        return send(res, 200, "text/javascript", result.code);
      }
      if (url.pathname.startsWith("/@fs/")) access.assert(fileFromUrl(url.pathname.slice(4)));
      else if (!url.pathname.startsWith("/@id/") && !url.pathname.startsWith("/@vite/")) {
        const absolute = path.join(root, decodeURIComponent(url.pathname));
        if (existsSync(absolute)) access.assert(absolute);
        const publicFile = path.join(root, "public", decodeURIComponent(url.pathname));
        if (existsSync(publicFile)) access.assert(publicFile, true);
      }
      vite.middlewares(req, res, () => send(res, 404, "text/plain", "not found"));
    } catch (error) {
      const message = String((error as Error).stack ?? error); errors.push({ url: req.url ?? "", message, at: Date.now() }); if (errors.length > 50) errors.shift(); notify({ type: "error", error: errors.at(-1) });
      send(res, error instanceof FileAccessError ? 403 : 500, "text/plain", message);
    }
  });
  try {
    vite = await createServer({
      root, appType: "custom", cacheDir, mode: "development",
      server: { middlewareMode: true, hmr: false, open: false, cors: false, watch: null, fs: { strict: true, allow: [root, ...options.allowedRoots ?? [], ...packageRoots, cacheDir, runtimeDir] } },
      plugins: [{
        name: "arguseye-source-and-runtime", enforce: "pre",
        configResolved(config: any) { config.root = root; config.server.proxy = undefined; config.server.open = false; config.server.cors = false; config.server.hmr = false; },
        resolveId(id: string) { if (id === "react-refresh/runtime") return runtimeRefresh; if (generated.has(id.split("?")[0])) return id; },
        load(id: string) {
          const file = id.split("?")[0];
          if (generated.has(file)) return generated.get(file);
          if (!path.isAbsolute(file) || !existsSync(file)) return;
          access.assert(file);
          if (!/[?&](vue|svelte)(?:&|=)/.test(id) && /\.(?:[cm]?[jt]sx?|vue|svelte|css|scss|sass)$/.test(file)) return source(file);
        },
      }],
    });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(options.port ?? 0, "127.0.0.1", () => resolve()); });
  } catch (error) { server.close(); rmSync(cacheDir, { recursive: true, force: true }); throw error; }
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const state = () => ({ epoch, versions: { ...versions } });
  const changed = (file: string): Update => {
    versions[file] = (versions[file] ?? 0) + 1; epoch++; generation++; vite.moduleGraph.invalidateAll();
    const update: Update = { kind: "reload", full: true, file, ...state() };
    for (const res of listeners) res.write(`data: ${JSON.stringify(update)}\n\n`);
    return update;
  };
  return {
    url,
    snapshot: () => ({ ...state(), generation, configDependencies: vite.config.configFileDependencies, context: globals(), warnings: [...app(lastTarget?.route).warnings], layouts: app(lastTarget?.route).layouts, setup }),
    async prepare(file: string, context?: { file: string; wrappers: Wrapper[] }, route?: string) { if (frameworkOf(file) === "html") throw new Error("HTML/Web Components currently use native mode; retry with --build-mode native."); if (file !== "/@empty") access.assert(file); if (context) access.assert(context.file); if (route) access.assert(route); lastTarget = { file, route }; return { generation, cached: false }; },
    updateBuffer(file: string, text?: string) { access.assert(file); if (text === undefined) overlay.delete(file); else overlay.set(file, text); return changed(file); },
    syncDisk() { for (const [file, seen] of mtimes) if (!overlay.has(file) && statSync(file, { throwIfNoEntry: false })?.mtimeMs !== seen) { mtimes.delete(file); changed(file); } return state(); },
    async sourceLocation(file: string, line: number, column: number) {
      access.assert(file);
      const result = await vite.transformRequest(fileUrl(file));
      if (!result?.map) return null;
      const point = originalPositionFor(new TraceMap(result.map as any), { line, column: column - 1 });
      if (!point.source || point.line === null || point.column === null) return null;
      const original = path.isAbsolute(point.source) ? point.source : path.resolve(path.dirname(file), point.source);
      access.assert(original);
      return { file: original, line: point.line, column: point.column + 1 };
    },
    async close() { for (const res of listeners) res.end(); server.closeAllConnections(); await Promise.all([new Promise<void>((done) => server.close(() => done())), vite.close()]); rmSync(cacheDir, { recursive: true, force: true }); },
  };
}

const slash = (file: string) => file.replaceAll(path.sep, "/");
function send(res: http.ServerResponse, status: number, type: string, body: string) { if (res.headersSent) return; res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-cache" }); res.end(body); }

/** Collects real declared transitive package roots so Vite cannot expose arbitrary workspace siblings. */
function dependencyRoots(root: string, entries: string[]): string[] {
  const resolver = createResolver(), roots = new Set<string>(), pending = [path.join(root, "package.json"), ...entries];
  while (pending.length && roots.size < 1000) {
    let dir = path.dirname(realpathSync(pending.pop()!));
    while (!existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) dir = path.dirname(dir);
    if (roots.has(dir)) continue;
    roots.add(dir);
    const manifest = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
    const deps = dir === root ? { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies } : { ...manifest.dependencies, ...manifest.optionalDependencies };
    for (const name of Object.keys(deps)) { const found = resolver.resolveFileSync(path.join(dir, "package.json"), name).path; if (found && existsSync(found)) pending.push(found); }
  }
  return [...roots];
}
