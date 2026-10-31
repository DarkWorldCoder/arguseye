import { vueRuntime } from "./vueRuntime.js";
import { svelteRuntime } from "./svelteRuntime.js";
import { frameworkOf } from "../project/framework.js";
import http from "node:http";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, statSync, watch } from "node:fs";
import type { AddressInfo } from "node:net";
import { ModuleGraph, readFromDisk } from "./moduleGraph.js";
import { DepBundler } from "./depBundler.js";
import { CssPipeline, isStylesheet } from "./cssPipeline.js";
import { contentType } from "./assets.js";
import { createFontContext } from "../project/createFontContext.js";

const SCRIPT_EXT = /\.(?:(m|c)?(j|t)sx?|vue|svelte)$/;
import { existsSync } from "node:fs";
import path from "node:path";
import { detectAppContext, wrapperModule } from "../project/appContext.js";
import { routerPackage } from "../project/routerPackage.js";
import { publicEnv } from "../project/publicEnv.js";
import { sourceFiles } from "../project/sourceFiles.js";
import { decodeContext, decodeTarget, encodeTarget, previewHtml, reactRuntime, refreshSetup, type PreviewTarget } from "./page.js";
import type { Wrapper } from "../project/appContext.js";

export type PreviewServerOptions = {
  root: string;
  /** Bundle every package the project's sources import at start, so later renders never rebuild or reload. */
  warmup?: boolean;
  /** Watch the project on disk and push changes to open pages (hot reload without an editor). */
  watch?: boolean;
  /** Fixed port (default: any free one), e.g. to keep a browser's permission for the origin. */
  port?: number;
};

export type PreviewServer = {
  url: string;
  /** Fingerprint of the source and styles actually read by this server, including unsaved buffers. */
  sourceRevision(): string;
  /** Per-file overlay version for incremental static analysis. */
  version(file: string): number;
  /** Context and framework limitations observed while preparing project modules. */
  warnings(file?: string): string[];
  /** Current global style URLs and root classes for warm pages, including unsaved layout edits. */
  context(): { globalCssUrls: string[]; htmlClass?: string; bodyClass?: string };
  /** Reads the same unsaved source as the module graph. */
  readSource(file: string): Promise<string>;
  moduleUrl(file: string): string;
  /** URL of a page that renders `target` and reports `window.__CP__.status`. `live: false` skips pushed updates. */
  pageUrl(target: PreviewTarget, options?: { live?: boolean }): string;
  /** Picks up files changed on disk since they were served (e.g. saved by an agent) and returns the version state. */
  syncDisk(): VersionState;
  /** Errors from serving modules (transform, resolve, bundling) since `since` (ms epoch), newest last. */
  errorsSince(since: number): ServeError[];
  /**
   * Makes sure every package `file` needs is bundled, and returns the bundle generation. A page loaded
   * under an older generation must be reloaded before showing `file`, or it would mix two React copies.
   */
  prepare(file: string, context?: { file: string; wrappers: Wrapper[] }, route?: string): Promise<{ generation: number; cached: boolean }>;
  /** Layout and template files that wrap a render for `route` (root first, project-relative). */
  layoutsFor(route?: string): string[];
  /** Resolves when the start-up warm-up (if any) is done; `prepare` waits for it too. */
  ready(): Promise<void>;
  /** Sets a file's unsaved contents (`undefined` = back to disk) and pushes the change to open pages. */
  updateBuffer(file: string, text: string | undefined): Update;
  close(): Promise<void>;
};

/** Pushed to open pages: `css` re-applies a stylesheet, `refresh` hot-swaps components, `reload` re-runs the graph. */
export type VersionState = { epoch: number; versions: Record<string, number> };

export type Update = VersionState & {
  kind: "css" | "refresh" | "reload";
  file: string;
  /** The edit pulled in packages that were not bundled yet: the whole page must reload. */
  full?: boolean;
};

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
  const hashes = new Map<string, string>();
  const moduleWarnings = new Map<string, string[]>();
  /**
   * Records the mtime a disk read saw. A read that finds an edit not registered yet (the usage index or export lookup
   * reading the file before a render syncs) registers it first; otherwise the page keeps the old module and Tailwind
   * never sees the edit's new classes.
   */
  const noteDiskRead = (file: string) => {
    const now = statSync(file).mtimeMs;
    const seen = servedMtimes.get(file);
    if (seen !== undefined && seen !== now) syncDisk();
    servedMtimes.set(file, now);
  };
  const readContextSource = (file: string) => {
    const source = overlay.get(file) ?? readFileSync(file, "utf8");
    if (!overlay.has(file)) noteDiskRead(file);
    hashes.set(file, createHash("sha256").update(source).digest("hex"));
    return source;
  };
  const fonts = createFontContext(options.root, readContextSource);
  const appContext = (route?: string) => detectAppContext(options.root, readContextSource, route, fonts.resolveClass);
  const globalStyles = (app: ReturnType<typeof appContext>) => [
    ...app.globalCss.map((file) => `/@fs${file}?import&${query(file).slice(1)}`),
    ...(fonts.stylesheet() ? ["/@next-fonts?v=" + createHash("sha256").update(fonts.stylesheet()).digest("hex").slice(0, 12)] : []),
  ];
  const readSource = async (file: string) => {
    const buffered = overlay.get(file);
    if (buffered === undefined) noteDiskRead(file);
    const source = buffered ?? await readFromDisk(file);
    const warnings: string[] = [];
    if (/next\/(headers|font|server)|["']use server["']/.test(source)) warnings.push(`${file}: Next.js server/font behavior requires the application runtime.`);
    if (/useNuxtApp|useAsyncData|defineNuxtConfig/.test(source)) warnings.push(`${file}: Nuxt application context is unsupported.`);
    moduleWarnings.set(file, warnings);
    hashes.set(file, createHash("sha256").update(source).digest("hex"));
    return source;
  };
  const css = new CssPipeline(options.root);
  const graph = new ModuleGraph(readSource, deps, query, css, options.root);
  const listeners = new Set<http.ServerResponse>();
  const serveErrors: ServeError[] = [];
  const errorsSince = (since: number) => serveErrors.filter((e) => e.at >= since);

  /** The project's data-router package, if any: components that use Link or router hooks render inside it. */
  const router = routerPackage(options.root);

  /** Where the generated wrapper "lives", so its imports resolve like the layout's. */
  const wrapperFile = (entry: string | undefined) =>
    entry ? entry.replace(/\.[^.]+$/, ".preview-wrapper.tsx") : path.join(options.root, "preview-wrapper.tsx");

  /** Where a generated call-site context "lives", so its imports resolve like the usage file's. */
  const contextFile = (usageFile: string) => usageFile.replace(/\.[^.]+$/, ".preview-context.tsx");

  /**
   * Crawls every project source once and bundles the union of their packages. If that union cannot be bundled
   * (a server-only package in the tree), the attempt is dropped and components bundle their own sets as before.
   */
  let warming: Promise<void> = Promise.resolve();
  async function warmup(): Promise<void> {
    const before = deps.wantedSpecs();
    try {
      for (const file of await sourceFiles(options.root)) await graph.crawl(file);
      const app = appContext();
      await graph.crawlVirtual(wrapperFile(app.entry), wrapperModule(app.wrappers, { router }));
      await deps.ensureBuilt();
    } catch (error) {
      deps.restore(before);
      const reason = String((error as Error).message ?? error).split("\n").filter((l) => l.trim() && !/^\s+at /.test(l)).slice(0, 4).join(" ");
      startupWarnings.push(`Project-wide package warm-up skipped: ${reason}`);
    }
  }
  const startupWarnings: string[] = [];

  async function prepare(file: string, context?: { file: string; wrappers: Wrapper[] }, route?: string): Promise<{ generation: number; cached: boolean }> {
    await warming;
    if (route) {
      const routed = appContext(route);
      await graph.crawlVirtual(wrapperFile(routed.entry), wrapperModule(routed.wrappers, { css: routed.globalCss, router }));
    }
    if (context?.wrappers.length) await graph.crawlVirtual(contextFile(context.file), wrapperModule(context.wrappers, { markInnermost: true }));
    ({ vue: ["vue"], svelte: ["svelte"], react: ["react", "react-dom", "react-dom/client", "react-refresh/runtime"] })[frameworkOf(file)].forEach((spec) => deps.add(spec));
    await graph.crawl(file);
    // The root layout's providers render around every component, so their packages belong in the same build
    // (only the providers: the layout itself may import server-only code).
    const app = appContext();
    if (app.entry) await readSource(app.entry);
    if (frameworkOf(file) === "react") await graph.crawlVirtual(wrapperFile(app.entry), wrapperModule(app.wrappers, { router }));
    await deps.ensureBuilt();
    return { generation: deps.generation, cached: deps.cached };
  }

  function updateBuffer(file: string, text: string | undefined): Update {
    if (text === undefined) overlay.delete(file);
    else overlay.set(file, text);
    if (!isStylesheet(file)) {
      // New utility classes in the edit: re-send the Tailwind sheets first so styles land with the markup.
      const content = text ?? readFileSync(file, "utf8");
      for (const sheet of css.sourceChanged(file, content)) changed(sheet);
    }
    const update = changed(file, SCRIPT_EXT.test(file));
    return update;
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

  function changed(file: string, mayAddPackages = false): Update {
    versions[file] = (versions[file] ?? 0) + 1;
    if (mayAddPackages) {
      // A new import of a package not bundled yet: bundle it and have pages reload into the new generation.
      void graph.crawl(file).then(() => {
        if (!deps.hasPending()) return;
        return deps.ensureBuilt().then(() => broadcast({ kind: "reload", file, epoch: ++epoch, versions: { ...versions }, full: true }));
      }).catch((error) => { serveErrors.push({ url: file, message: String(error), at: Date.now() }); });
    }
    const kind = isStylesheet(file) ? "css" : graph.isRefreshBoundary(file) ? "refresh" : "reload";
    if (kind === "reload") epoch++;
    const update: Update = { kind, file, epoch, versions: { ...versions } };
    broadcast(update);
    return update;
  }

  function broadcast(update: Update) {
    const message = `data: ${JSON.stringify(update)}\n\n`;
    for (const res of listeners) res.write(message);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    try {
      if (url.pathname === "/") {
        const target = decodeTarget(url.searchParams.get("t") ?? "");
        await prepare(target.file);
        const state = { epoch, versions, live: url.searchParams.get("live") !== "0" };
        const app = appContext();
        const globalCssUrls = globalStyles(app);
        return send(res, 200, "text/html", previewHtml(target, { state, env: publicEnv(options.root), globalCssUrls, htmlClass: app.htmlClass, bodyClass: app.bodyClass }));
      }
      if (url.pathname === "/@context") {
        const { file, wrappers } = decodeContext(url.searchParams.get("c") ?? "");
        return send(res, 200, "text/javascript", await graph.loadVirtual(contextFile(file), wrapperModule(wrappers, { markInnermost: true })));
      }
      if (url.pathname === "/@next-fonts") return send(res, 200, "text/javascript", `let style = document.getElementById("cp-next-fonts"); if (!style) { style = document.createElement("style"); style.id = "cp-next-fonts"; document.head.append(style); } style.textContent = ${JSON.stringify(fonts.stylesheet())};`);
      if (url.pathname === "/@wrapper") {
        const route = url.searchParams.get("route") ?? undefined;
        const app = appContext(route);
        // Nested layouts' own global CSS (e.g. a template importing "swiper/css") loads with the wrapper.
        const rootCss = new Set(appContext().globalCss);
        const css = route ? app.globalCss.filter((f) => !rootCss.has(f)) : [];
        return send(res, 200, "text/javascript", await graph.loadVirtual(wrapperFile(app.entry), wrapperModule(app.wrappers, { css, router })));
      }
      if (url.pathname === "/@graph") {
        // Everything a target will import, so the page can preload it in one parallel batch instead of a waterfall.
        const file = url.searchParams.get("file") ?? "";
        const route = url.searchParams.get("route") ?? undefined;
        const urls = new Set<string>(file && file !== "/@empty" ? graph.reachableUrls(file) : []);
        const app = appContext(route);
        for (const u of graph.reachableUrls(wrapperFile(app.entry))) urls.add(u);
        return send(res, 200, "application/json", JSON.stringify([...urls]));
      }
      if (url.pathname === "/@fs/@empty") {
        return send(res, 200, "text/javascript", "export default function Empty() { return null; }");
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
      if (url.pathname === "/@runtime" && url.searchParams.get("framework") === "vue") return send(res, 200, "text/javascript", vueRuntime);
      if (url.pathname === "/@runtime" && url.searchParams.get("framework") === "svelte") { deps.add("svelte"); return send(res, 200, "text/javascript", svelteRuntime); }
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
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(options.port ?? 0, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
  const { port } = server.address() as AddressInfo;

  if (options.warmup) warming = warmup();

  // Disk watcher: a file served to a page that changes on disk (saved by anyone) is pushed like an editor edit.
  let watcher: ReturnType<typeof watch> | undefined;
  if (options.watch) {
    const pending = new Map<string, NodeJS.Timeout>();
    watcher = watch(options.root, { recursive: true }, (_event, name) => {
      if (!name || /node_modules|\.git[\/]|\.arguseye/.test(name)) return;
      const file = path.join(options.root, name);
      if (!servedMtimes.has(file) || overlay.has(file)) return;
      clearTimeout(pending.get(file));
      pending.set(file, setTimeout(() => { pending.delete(file); syncDisk(); }, 30));
    });
    watcher.on("error", () => {});
  }

  return {
    url: `http://127.0.0.1:${port}`,
    context: () => { const app = appContext(); return { globalCssUrls: globalStyles(app), htmlClass: app.htmlClass, bodyClass: app.bodyClass }; },
    warnings: (file) => {
      const app = appContext();
      const relevant = file ? new Set([...graph.filesFor(file), ...graph.filesFor(wrapperFile(app.entry)), ...(app.entry ? [app.entry] : [])]) : undefined;
      return [...startupWarnings, ...app.warnings, ...[...moduleWarnings].filter(([source]) => !relevant || relevant.has(source)).flatMap(([, warnings]) => warnings)];
    },
    version: (file) => versions[file] ?? 0,
    sourceRevision: () => createHash("sha256").update(JSON.stringify([...hashes].sort(([a], [b]) => a.localeCompare(b)))).digest("hex"),
    readSource,
    moduleUrl: (file) => `/@fs${file}`,
    pageUrl: (target, { live = true } = {}) => `/?t=${encodeTarget(target)}${live ? "" : "&live=0"}`,
    updateBuffer,
    syncDisk,
    errorsSince,
    prepare,
    ready: () => warming,
    layoutsFor: (route) => appContext(route).layouts,
    close: () => new Promise((r) => { watcher?.close(); server.closeAllConnections(); server.close(() => r()); }),
  };
}

function sendFile(res: http.ServerResponse, file: string) {
  res.writeHead(200, { "content-type": contentType(file), "cache-control": "no-cache" });
  res.end(readFileSync(file));
}

/** CP_DEBUG_LOG=<file> appends every response, for debugging a host (like a webview) whose requests are invisible. */
const debugLog = process.env.CP_DEBUG_LOG;

function send(res: http.ServerResponse, status: number, type: string, body: string) {
  if (debugLog) appendFileSync(debugLog, `${status} ${(res.req as http.IncomingMessage).url}\n`);
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-cache" });
  res.end(body);
}
