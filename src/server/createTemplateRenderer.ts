import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createResolver } from "./resolver.js";
import { templateConfig, templateEngine } from "../project/templateConfig.js";
import { TEMPLATE_ENGINES, isTemplateFile, type TemplateEngine } from "../project/templateEngines.js";
import type { PreviewTarget } from "./page.js";

type Reply = { sources?: Record<string, string>; v: number; id: number; html: string; dependencies: string[]; errors: string[]; warnings: string[]; unresolved: string[]; engineVersion?: string; runtimeVersion?: string };
/** Names the native engine, inputs and sources behind the rendered document. */
export type TemplateEvidence = { engine: string; runtime: string; engineVersion?: string; runtimeVersion?: string; profile?: string; dependencies: string[]; unresolved: string[]; stateReset: true };
/** Native template workers share the bounded source overlay and return HTML to the existing browser runtime. */
export function createTemplateRenderer(root: string, read: (file: string) => string, assertAccess: (file: string) => void, overlays: Map<string, string>) {
  let sequence = 0, closed = false, configured = existsSync(path.join(root, "arguseye.templates.json"));
  type Worker = { child: ChildProcessWithoutNullStreams; active?: { id: number; resolve: (r: Reply) => void; reject: (e: Error) => void }; output: string; tail: string; renders: number };
  const workers = new Map<string, Worker>();
  const queues = new Map<string, { chain: Promise<unknown>; queued: number }>();
  const config = () => templateConfig(root, read);
  const candidate = (file: string) => isTemplateFile(file) || file.endsWith(".html") || file.endsWith(".tpl");
  const select = (target: PreviewTarget): PreviewTarget => {
    if (!target.engine && !candidate(target.file) && !configured && !overlays.has(path.join(root, "arguseye.templates.json"))) return target;
    const cfg = config(), engine = templateEngine(root, target.file, cfg, target.engine, false, read);
    if (!engine) return target;
    if (target.templateResolved) return { ...target, engine };
    let data: Record<string, unknown> = {};
    if (target.profile) {
      const profile = cfg.profiles?.[target.profile];
      if (!Object.hasOwn(cfg.profiles ?? {}, target.profile)) throw new Error(`Unknown template data profile "${target.profile}" in ${root}`);
      data = typeof profile === "string" ? JSON.parse(read(path.resolve(root, profile))) : profile;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`Template data profile "${target.profile}" must contain a JSON object`);
    }
    return { ...target, engine, props: { ...data, ...target.props }, templateResolved: true };
  };
  const kill = (key: string, error: Error) => {
    const worker = workers.get(key); if (!worker) return;
    workers.delete(key); worker.active?.reject(error); worker.active = undefined; worker.child.kill();
  };
  const script = (runtime: string) => {
    const name = runtime === "node" ? "node.mjs" : runtime === "python" ? "python.py" : runtime === "php" ? "php.php" : "ruby.rb";
    const built = fileURLToPath(new URL("./template-workers/" + name, import.meta.url));
    return existsSync(built) ? built : fileURLToPath(new URL("./templateWorkers/" + name, import.meta.url));
  };
  function workerFor(key: string, command: string[], environment: NodeJS.ProcessEnv): Worker {
    let worker = workers.get(key); if (worker) return worker;
    if (workers.size >= 4) {
      const idle = [...workers].find(([id, value]) => !value.active && !queues.get(id)?.queued);
      if (!idle) throw new Error("Template runtime pool is busy; retry after a render finishes (maximum four runtimes).");
      kill(idle[0], new Error("Template worker evicted"));
    }
    const child = spawn(command[0], command.slice(1), { cwd: root, env: environment, stdio: "pipe", windowsHide: true });
    worker = { child, output: "", tail: "", renders: 0 }; workers.set(key, worker);
    child.stderr.on("data", (chunk) => { worker!.tail = (worker!.tail + String(chunk)).slice(-4096); });
    child.on("error", (error) => { if (workers.get(key) === worker) kill(key, new Error(`Template runtime could not start: ${command[0]}: ${error.message}. Configure the project's runtime in arguseye.templates.json.`)); });
    child.on("exit", () => { if (workers.get(key) === worker) kill(key, new Error(`Template runtime exited: ${worker!.tail || command[0]}`)); });
    child.stdout.setEncoding("utf8");
    child.stdin.on("error", (error) => { if (workers.get(key) === worker) kill(key, error); });
    child.stdout.on("data", (chunk) => {
      worker!.output += String(chunk);
      if (Buffer.byteLength(worker!.output) > 8 * 1024 * 1024) { kill(key, new Error("Template runtime output exceeded 8 MiB")); return; }
      let index: number;
      while ((index = worker!.output.indexOf("\n")) >= 0) {
        const line = worker!.output.slice(0, index); worker!.output = worker!.output.slice(index + 1);
        try {
          const reply = JSON.parse(line);
          if (reply.v !== 1 || !worker!.active || reply.id !== worker!.active.id || typeof reply.html !== "string" || !Array.isArray(reply.dependencies) || !Array.isArray(reply.errors) || !Array.isArray(reply.warnings) || !Array.isArray(reply.unresolved) || [reply.dependencies, reply.errors, reply.warnings, reply.unresolved].some((values) => values.some((value: unknown) => typeof value !== "string"))) throw new Error("Invalid or stale template worker reply");
          const active = worker!.active; worker!.active = undefined; active.resolve(reply); worker!.renders++;
          const idle = setTimeout(() => { if (workers.get(key) === worker && !worker!.active && !queues.get(key)?.queued) kill(key, new Error("Idle template worker expired")); }, 60000); idle.unref();
        } catch (error) { kill(key, new Error(`Invalid template worker protocol: ${(error as Error).message}`)); return; }
      }
    });
    return worker;
  }
  return {
    select,
    info(file: string) { const cfg = config(); return { engine: templateEngine(root, file, cfg, undefined, true, read), engines: [...Object.keys(TEMPLATE_ENGINES), ...Object.keys(cfg.adapters ?? {})], profiles: Object.keys(cfg.profiles ?? {}) }; },
    asset(url: string): string | undefined {
      for (const [prefix, directory] of Object.entries(config().static ?? {})) if (url.startsWith(prefix)) { const base = path.resolve(root, directory), file = path.resolve(base, url.slice(prefix.length)); assertAccess(file);
        const relative = path.relative(realpathSync(base), realpathSync(file));
        if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error(`Template static asset escapes its mapped root: ${url}`);
        return file; }
      return undefined;
    },
    async render(input: PreviewTarget, signal: AbortSignal) {
      if (closed) throw new Error("Template session is closed");
      const target = select(input), cfg = config(), engine = target.engine!;
      const native = Object.hasOwn(TEMPLATE_ENGINES, engine) ? TEMPLATE_ENGINES[engine as TemplateEngine] : undefined, custom = Object.hasOwn(cfg.adapters ?? {}, engine) ? cfg.adapters![engine] : undefined;
      const runtime = native?.runtime ?? "custom";
      const dirs = (cfg.roots ?? ["."]).map((directory) => path.resolve(root, directory)); dirs.forEach(assertAccess);
      let command: string[], engineEntry: string | undefined;
      if (custom) {
        if (!Array.isArray(custom.command) || !custom.command.length || custom.command.some((v) => typeof v !== "string" || !v)) throw new Error(`Custom template engine "${engine}" requires a command array`);
        command = custom.command.map((arg) => arg.replaceAll("${root}", root));
      } else {
        if (!native) throw new Error(`Unknown template engine "${engine}"`);
        let executable = cfg.runtimes?.[runtime];
        if (executable && (executable.startsWith(".") || path.isAbsolute(executable))) executable = path.resolve(root, executable);
        if (runtime === "node") {
          executable ??= process.execPath;
          engineEntry = createResolver("node").resolveFileSync(path.join(root, "package.json"), native.package).path ?? undefined;
          if (!engineEntry) throw new Error(`Template engine "${engine}" is not installed in ${root}; install this project's ${native.package} dependency.`);
        } else if (runtime === "python") {
          const local = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
          executable ??= existsSync(local) ? local : process.platform === "win32" ? "python" : "python3";
        } else executable ??= runtime;
        command = [executable, script(runtime)];
      }
      const setup = cfg.setup?.[engine] ? path.resolve(root, cfg.setup[engine]) : undefined; if (setup) read(setup);
      const request = { v: 1, id: ++sequence, type: "render", root, file: target.file, engine, engineEntry, roots: dirs.map((dir) => realpathSync(dir)), dirs, props: target.props ?? {}, options: cfg.options?.[engine] ?? {}, setup, overlays: Object.fromEntries(overlays) };
      if (Buffer.byteLength(JSON.stringify(request)) > 8 * 1024 * 1024) throw new Error("Template request and unsaved buffers exceed 8 MiB");
      const key = JSON.stringify([engine, command, engineEntry, dirs, cfg.options?.[engine], setup]);
      const queue = queues.get(key) ?? { chain: Promise.resolve(), queued: 0 }; queues.set(key, queue);
      if (queue.queued >= 32) throw new Error("Template render queue is full (32 requests); retry after a render finishes.");
      queue.queued++;
      const run = async () => {
        if (signal.aborted) throw new Error("Template render cancelled");
        const worker = workerFor(key, command, { ...process.env, ...(runtime === "node" ? { ELECTRON_RUN_AS_NODE: "1" } : {}), PYTHONUNBUFFERED: "1", PYTHONDONTWRITEBYTECODE: "1" });
        return new Promise<Reply>((resolve, reject) => {
          const abort = () => kill(key, new Error("Template render cancelled"));
          const timeout = cfg.limits?.timeoutMs ?? 20000;
          const timer = setTimeout(() => kill(key, new Error(`Template render exceeded ${timeout} ms: ${target.file}`)), timeout);
          const done = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
          worker.active = { id: request.id, resolve: (reply) => { done(); resolve(reply); }, reject: (error) => { done(); reject(error); } };
          signal.addEventListener("abort", abort, { once: true });
          worker.child.stdin.write(JSON.stringify(request) + "\n", (error) => { if (error) kill(key, error); });
        });
      };
      const pending = queue.chain.then(run); queue.chain = pending.catch(() => {});
      try {
        const result = await pending;
        for (const file of result.dependencies) { assertAccess(file); try { const source = read(file); if (result.sources?.[file] && createHash("sha256").update(source).digest("hex") !== result.sources[file]) result.warnings.push(`Source changed during template rendering: ${file}; render again before reviewing this capture.`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
        if (custom && !result.sources) result.warnings.push("Custom adapter did not report source hashes; concurrent source consistency is not established.");
        const evidence: TemplateEvidence = { engine, runtime, engineVersion: result.engineVersion, runtimeVersion: result.runtimeVersion, profile: target.profile, dependencies: result.dependencies.map((file) => path.relative(root, file).split(path.sep).join("/")), unresolved: result.unresolved, stateReset: true };
        return { ...result, template: evidence };
      } finally { queue.queued--; if (!queue.queued) queues.delete(key); if ((!!setup || (engine === "php" || engine === "erb") && input.fresh) || (workers.get(key)?.renders ?? 0) >= 128) kill(key, new Error("Verification recreates executable template state")); }
    },
    invalidate() { configured = existsSync(path.join(root, "arguseye.templates.json")); for (const key of workers.keys()) kill(key, new Error("Template configuration changed; retry this render.")); },
    close() { closed = true; for (const key of workers.keys()) kill(key, new Error("Template session closed")); },
  };
}
