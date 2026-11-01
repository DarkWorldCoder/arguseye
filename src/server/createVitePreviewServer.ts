import { fileUrl } from "./fileUrl.js";
import { fork, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFileAccess } from "./createFileAccess.js";
import { encodeTarget } from "./page.js";
import type { PreviewServer, PreviewServerOptions, ServeError, Update, VersionState } from "./createPreviewServer.js";
import { buildInputs } from "../project/buildInputs.js";
import { frameworkOf } from "../project/framework.js";

let devWorker: Promise<string> | undefined;
/** Uses the packaged worker, or compiles the development source once without relying on stale dist output. */
async function workerScript(): Promise<string> {
  const source = fileURLToPath(new URL("./viteCompatibilityWorker.ts", import.meta.url));
  if (!existsSync(source)) return fileURLToPath(new URL("./vite-compatibility-worker.mjs", import.meta.url));
  return devWorker ??= (async () => {
    const { rolldown } = await import("rolldown");
    const directory = path.resolve(path.dirname(source), "../../node_modules/.cache/arguseye-vite-worker");
    mkdirSync(directory, { recursive: true });
    const bundle = await rolldown({ input: source, platform: "node", external: (id) => !id.startsWith(".") && !path.isAbsolute(id) });
    try { await bundle.write({ file: path.join(directory, "worker.mjs"), format: "esm" }); } finally { await bundle.close(); }
    return path.join(directory, "worker.mjs");
  })();
}

/** Keeps project Vite config, plugins, cwd and Node environment isolated from native preview sessions. */
export async function createVitePreviewServer(options: PreviewServerOptions): Promise<PreviewServer> {
  const started = performance.now();
  const root = path.resolve(options.root);
  let access = createFileAccess(root, options.allowedRoots);
  const overlay = new Map<string, string>(), hashes = new Map<string, string>(), mtimes = new Map<string, number>();
  const errors: ServeError[] = [];
  let state: any = { epoch: 0, versions: {}, context: { globalCssUrls: [] }, warnings: [], layouts: [], setup: {} };
  let child: ChildProcess | undefined, url = "", closed = false, sequence = 0, generation = 0;
  let writes: Promise<unknown> = Promise.resolve();
  const calls = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
  const inputs = () => buildInputs(root, state.configDependencies);
  let config = inputs(), restart = false;
  const fail = (error: Error) => { for (const call of calls.values()) { clearTimeout(call.timer); call.reject(error); } calls.clear(); };
  const stop = () => { const current = child; child = undefined; current?.kill("SIGKILL"); fail(new Error("Vite compatibility worker stopped; render again to restart it.")); };
  const rpc = (method: string, ...args: unknown[]): Promise<any> => new Promise((resolve, reject) => {
    if (!child?.connected) return reject(new Error("Vite compatibility worker is unavailable; render again to restart it."));
    const id = ++sequence;
    const timer = setTimeout(() => { stop(); reject(new Error(`Vite ${method} timed out after 30 s; check the project's config/plugins and retry.`)); }, 30000);
    calls.set(id, { resolve, reject, timer }); child.send({ id, method, args });
  });
  const start = async () => {
    if (closed) throw new Error("Arguseye session is closed");
    if (child && !restart) return;
    if (child) stop();
    restart = false; access = createFileAccess(root, options.allowedRoots);
    const worker = await workerScript();
    child = fork(worker, [], { cwd: root, env: { ...process.env, NODE_ENV: "development" }, stdio: ["ignore", "ignore", "pipe", "ipc"], execArgv: [] });
    const current = child;
    current.on("error", (error) => { if (child === current) { child = undefined; fail(error); } });
    current.on("exit", () => { if (child === current) { child = undefined; fail(new Error("Vite compatibility worker exited; inspect the config or render again.")); } });
    current.stderr?.on("data", (chunk) => { const message = String(chunk).slice(0, 4000); if (/error|failed/i.test(message)) { errors.push({ url: "vite", message, at: Date.now() }); if (errors.length > 50) errors.shift(); } });
    current.on("message", (message: any) => {
      if (child !== current) return;
      if (message.event?.type === "source") {
        const event = message.event; hashes.set(event.file, createHash("sha256").update(event.source).digest("hex")); if (event.mtime !== undefined) mtimes.set(event.file, event.mtime); return;
      }
      if (message.event?.type === "error") { errors.push(message.event.error); if (errors.length > 50) errors.shift(); return; }
      if (message.state) state = { ...message.state, epoch: message.state.epoch + generation * 100000 };
      const call = calls.get(message.id); if (!call) return;
      clearTimeout(call.timer); calls.delete(message.id);
      if (message.error) call.reject(new Error(message.error)); else call.resolve(message.value);
    });
    generation++;
    url = await rpc("start", { ...options, ...(url ? { port: Number(new URL(url).port) } : {}) });
    for (const [file, text] of overlay) await rpc("updateBuffer", file, text);
    config = inputs();
  };
  try { await start(); } catch (error) { stop(); throw error; }
  const enqueue = (method: string, ...args: unknown[]) => { writes = writes.then(() => rpc(method, ...args)); writes.catch(() => {}); };
  const syncDisk = (): VersionState => {
    const next = inputs();
    if (next !== config) { config = next; restart = true; state.epoch++; }
    for (const [file, seen] of mtimes) if (!overlay.has(file) && statSync(file, { throwIfNoEntry: false })?.mtimeMs !== seen) { mtimes.delete(file); state.versions[file] = (state.versions[file] ?? 0) + 1; state.epoch++; }
    if (!restart && child) enqueue("syncDisk");
    return { epoch: state.epoch, versions: { ...state.versions } };
  };
  return {
    get url() { return url; },
    build: { mode: "vite", executesVitePlugins: true, startupMs: Math.round(performance.now() - started) },
    assertAccess: (file) => access.assert(file),
    readSource: async (file) => { access.assert(file); const text = overlay.get(file) ?? readFileSync(file, "utf8"); hashes.set(file, createHash("sha256").update(text).digest("hex")); return text; },
    sourceRevision: () => createHash("sha256").update(JSON.stringify([...hashes].sort(([a], [b]) => a.localeCompare(b)))).digest("hex"),
    version: (file) => state.versions[file] ?? 0,
    warnings: () => state.warnings,
    context: () => state.context,
    moduleUrl: fileUrl,
    pageUrl: (target, { live = true } = {}) => `/?t=${encodeTarget(target)}${live ? "" : "&live=0"}`,
    sourceLocation: async (file, line, column) => { access.assert(file); return rpc("sourceLocation", file, line, column); },
    syncDisk, errorsSince: (since) => errors.filter((e) => e.at >= since),
    async prepare(...args) { await writes.catch(() => {}); await start(); writes = Promise.resolve(); const value = await rpc("prepare", ...args); return { ...value, generation: value.generation + generation * 100000 }; },
    layoutsFor: () => state.layouts,
    setupFor: (file) => frameworkOf(file) === "vue" ? state.setup.vue : frameworkOf(file) === "react" ? state.setup.jsx : frameworkOf(file) === "svelte" ? state.setup.svelte : undefined,
    ready: async () => {},
    updateBuffer(file, text) {
      access.assert(file); if (text === undefined) overlay.delete(file); else overlay.set(file, text);
      state.versions[file] = (state.versions[file] ?? 0) + 1; state.epoch++;
      enqueue("updateBuffer", file, text);
      return { kind: "reload", full: true, file, epoch: state.epoch, versions: { ...state.versions } } as Update;
    },
    async close() { closed = true; try { if (child) await rpc("close"); } finally { stop(); } },
  };
}
