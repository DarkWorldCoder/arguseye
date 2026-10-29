import { builtinModules, createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { init as initCjsLexer, parse as parseCjs } from "cjs-module-lexer";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { rolldown } from "rolldown";
import { ResolverFactory } from "oxc-resolver";
import { init, parse } from "es-module-lexer";

const FACADE = "\0facade:";
const cjsLexerReady = initCjsLexer();

/**
 * Named exports of a CommonJS file without running it (browser-only packages touch `window` on load):
 * the same lexer Node uses for `import` of CJS, following `module.exports = require(...)` re-exports.
 * Falls back to executing the module only when the lexer finds nothing.
 */
async function cjsExportNames(file: string, depth = 0): Promise<string[]> {
  await cjsLexerReady;
  const source = readFileSync(file, "utf8");
  let names: string[] = [];
  let reexports: string[] = [];
  try {
    ({ exports: names, reexports } = parseCjs(source));
  } catch {
    return requireExportNames(file);
  }
  if (depth < 3) {
    const req = createRequire(file);
    for (const spec of reexports) {
      try {
        names.push(...(await cjsExportNames(req.resolve(spec), depth + 1)));
      } catch {}
    }
  }
  return names.length ? [...new Set(names)] : requireExportNames(file);
}

function requireExportNames(file: string): string[] {
  try {
    return Object.keys(createRequire(file)(file));
  } catch {
    return [];
  }
}
/** Bump when the bundle output format changes, so stale on-disk bundles are not reused. */
const BUNDLER_VERSION = 2;
/** Builds with at least this many packages run in a worker process (memory), smaller ones in-process (latency). */
const WORKER_THRESHOLD = 12;
const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"];
// CommonJS on purpose: named imports from it become `undefined` at runtime instead of a build-time missing-export error.
const EMPTY = "\0node-builtin-empty.cjs";
/** Node built-ins have no browser equivalent; packages that reach them get an empty module, as bundlers do. */
const NODE_BUILTINS = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
const ownRequire = createRequire(import.meta.url);
/**
 * Next's app router runs on the React canary vendored inside `next` (with `cache`, `use`), not on the
 * project's `react`. Previews of such projects resolve React the same way, so the same APIs exist.
 */
function vendoredReact(root: string): Record<string, string> | undefined {
  const compiled = path.join(root, "node_modules", "next", "dist", "compiled");
  const hasAppDir = ["app", "src/app"].some((d) => existsSync(path.join(root, d)));
  if (!hasAppDir || !existsSync(path.join(compiled, "react", "index.js")) || !existsSync(path.join(compiled, "react-dom", "index.js"))) return undefined;
  return { react: path.join(compiled, "react"), "react-dom": path.join(compiled, "react-dom") };
}

/** Packages the preview runtime itself needs; resolved from this extension, not the user's project. */
const OWN: Record<string, string> = { "react-refresh/runtime": ownRequire.resolve("react-refresh/runtime") };
const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * Pre-bundles the npm packages the preview imports into one code-split ESM build,
 * so packages share a single copy of React and are bundled once, not per keystroke.
 */
export class DepBundler {
  private wanted = new Set<string>();
  private built = new Set<string>();
  private files = new Map<string, string>();
  private building: Promise<void> | undefined;
  /** Bumps on every build. Chunks may re-hash between builds, so a page must not mix two generations. */
  generation = 0;
  /** True when the current bundle came from the on-disk cache rather than a fresh build. */
  cached = false;
  private cacheDir: string;

  private static rolldownVersion = ownRequire("rolldown/package.json").version as string;
  private resolver = new ResolverFactory({
    conditionNames: ["browser", "import", "module", "default"],
    mainFields: ["browser", "module", "main"],
    moduleType: true,
  });

  /** Package aliases that mirror how the app's own bundler resolves them (vendored React in Next app router). */
  private aliases: Record<string, string>;

  constructor(private root: string) {
    this.aliases = vendoredReact(root) ?? {};
    this.cacheDir = path.join(root, "node_modules", ".component-preview", "deps");
    // Temp folders left by a process that died mid-write.
    try {
      for (const name of readdirSync(this.cacheDir)) if (/\.\d+$/.test(name)) rmSync(path.join(this.cacheDir, name), { recursive: true, force: true });
    } catch {}
  }

  add(specifier: string) {
    this.wanted.add(specifier);
  }

  /** The packages requested so far; `restore` drops later additions (after a failed speculative build). */
  wantedSpecs(): string[] {
    return [...this.wanted];
  }
  restore(specs: string[]) {
    this.wanted = new Set(specs);
  }

  /** `name` is the path after `/@deps/`, e.g. `react.js` or `_chunk-abc.js`. */
  async get(name: string): Promise<string | undefined> {
    const spec = name.replace(/\.js$/, "");
    if (!name.startsWith("_chunk-") && !this.wanted.has(spec)) this.wanted.add(spec);
    await this.ensureBuilt();
    return this.files.get(name);
  }

  hasPending(): boolean {
    return [...this.wanted].some((s) => !this.built.has(s));
  }

  async ensureBuilt({ inProcess = false } = {}) {
    while ([...this.wanted].some((s) => !this.built.has(s))) {
      this.building ??= this.build(inProcess).finally(() => (this.building = undefined));
      await this.building;
    }
  }

  /** The built worker script, when this code runs from a build that ships it (dist/), else undefined. */
  private static workerScript(): string | undefined {
    for (const candidate of ["./bundle-worker.mjs", "../../dist/bundle-worker.mjs"]) {
      const file = fileURLToPath(new URL(candidate, import.meta.url));
      if (existsSync(file)) return file;
    }
    return undefined;
  }

  /** Runs the build in a child process; resolves true when it produced the cache, false when no worker is available. */
  private async buildInWorker(specs: string[]): Promise<boolean> {
    const script = DepBundler.workerScript();
    if (!script || process.env.CP_INPROCESS_BUNDLE) return false;
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script], { stdio: ["pipe", "ignore", "pipe"] });
      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d));
      child.on("error", reject);
      child.on("exit", (code) => (code === 0 ? resolve(true) : reject(new Error(stderr || `bundle worker exited with ${code}`))));
      child.stdin.end(JSON.stringify({ root: this.root, specs }));
    });
  }

  private async build(inProcess = false) {
    const specs = [...this.wanted].sort();
    const key = this.cacheKey(specs);
    const dir = path.join(this.cacheDir, key);
    // Large sets are built by a worker process that writes the cache and exits; the result is then read below.
    if (!inProcess && !existsSync(path.join(dir, "manifest.json")) && specs.length >= WORKER_THRESHOLD) {
      await this.buildInWorker(specs);
    }
    if (existsSync(path.join(dir, "manifest.json"))) {
      // Names are paths ("react/jsx-dev-runtime.js"), so the cache folder is read recursively.
      const names = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith(".js"));
      this.files = new Map(names.map((f) => [f, readFileSync(path.join(dir, f), "utf8")] as const));
      specs.forEach((s) => this.built.add(s));
      this.generation++;
      this.cached = true;
      return;
    }
    await this.bundle(specs);
    this.cached = false;
    try {
      const tmp = `${dir}.${process.pid}`;
      mkdirSync(tmp, { recursive: true });
      for (const [name, code] of this.files) {
        mkdirSync(path.dirname(path.join(tmp, name)), { recursive: true });
        writeFileSync(path.join(tmp, name), code);
      }
      writeFileSync(path.join(tmp, "manifest.json"), JSON.stringify({ specs, rolldown: DepBundler.rolldownVersion }));
      rmSync(dir, { recursive: true, force: true });
      renameSync(tmp, dir);
    } catch {
      // a read-only or missing node_modules only costs the cache
    }
  }

  /** Same packages, same lockfile, same bundler: the same output. */
  private cacheKey(specs: string[]): string {
    const hash = createHash("sha1").update(`${BUNDLER_VERSION}|${DepBundler.rolldownVersion}|${JSON.stringify(this.aliases)}|${specs.join(",")}`);
    for (const name of LOCKFILES) {
      const file = path.join(this.root, name);
      if (!existsSync(file)) continue;
      const stat = statSync(file);
      hash.update(`|${name}:${stat.size}:${stat.mtimeMs}`);
      break;
    }
    return hash.digest("hex").slice(0, 16);
  }

  private async bundle(specs: string[]) {
    const facades = new Map(await Promise.all(specs.map(async (s) => [s, await this.facade(s)] as const)));
    const bundle = await rolldown({
      input: Object.fromEntries(specs.map((s) => [s, FACADE + s])),
      cwd: this.root,
      platform: "browser",
      // "use client"/"use server" directives are expected in app packages and mean nothing to a preview.
      onLog: (level, log, defaultHandler) => {
        if (log.code !== "MODULE_LEVEL_DIRECTIVE" && log.code !== "EMPTY_BUNDLE") defaultHandler(level, log);
      },
      resolve: { alias: { ...this.aliases, ...OWN } },
      transform: { define: { "process.env.NODE_ENV": '"development"' } },
      plugins: [
        {
          name: "facades",
          resolveId: (id) => (id.startsWith(FACADE) ? id : NODE_BUILTINS.has(id) ? EMPTY : null),
          load: (id) => (id.startsWith(FACADE) ? facades.get(id.slice(FACADE.length)) : id === EMPTY ? "module.exports = {};" : null),
        },
        {
          // Packages that import their own stylesheets from JS (editors, sliders): the CSS is injected at load, as
          // the app's bundler would, instead of failing the build.
          name: "package-css",
          load: (id) => {
            if (!/\.css$/.test(id) || id.includes("\0")) return null;
            const css = JSON.stringify(readFileSync(id, "utf8"));
            const code = `const css = ${css}; if (typeof document !== "undefined" && !document.querySelector('style[data-pkg-css=${JSON.stringify(id)}]')) { const s = document.createElement("style"); s.dataset.pkgCss = ${JSON.stringify(id)}; s.textContent = css; document.head.append(s); } export default css;`;
            return { code, moduleType: "js" as const };
          },
        },
      ],
    });
    let output;
    try {
      ({ output } = await bundle.generate({
        format: "esm",
        entryFileNames: "[name].js",
        chunkFileNames: "_chunk-[hash].js",
        // Smaller bundles parse faster in the browser; names are kept so React component names stay readable.
        minify: { compress: true, mangle: false, codegen: { removeWhitespace: true } },
      }));
    } finally {
      await bundle.close(); // a failed build must not keep its whole module graph in memory
    }
    this.files = new Map(output.flatMap((o) => (o.type === "chunk" ? [[o.fileName, o.code] as const] : [])));
    specs.forEach((s) => this.built.add(s));
    this.generation++;
  }

  /** The file an aliased specifier (e.g. `react/jsx-dev-runtime` under a vendored React) resolves to. */
  private aliased(spec: string): string | undefined {
    for (const [name, dir] of Object.entries(this.aliases)) {
      if (spec === name) return this.resolver.resolveFileSync(path.join(dir, "package.json"), dir).path ?? path.join(dir, "index.js");
      if (spec.startsWith(name + "/")) return this.resolver.resolveFileSync(path.join(dir, "package.json"), path.join(dir, spec.slice(name.length + 1))).path;
    }
    return undefined;
  }

  /**
   * Re-exports a package so CommonJS packages (like React) expose their named exports.
   * ESM vs CommonJS is decided from the file the bundler will actually use (packages like MUI ship ESM at
   * the root and CommonJS under `main`), by its syntax rather than by package.json metadata.
   */
  private async facade(spec: string): Promise<string> {
    const id = JSON.stringify(spec);
    const file = OWN[spec] ?? this.aliased(spec) ?? this.resolver.resolveFileSync(path.join(this.root, "index.js"), spec).path;
    if (!file) throw new Error(`Cannot resolve package "${spec}" from ${this.root}`);
    await init;
    const [, exports, , hasModuleSyntax] = parse(readFileSync(file, "utf8"));
    if (hasModuleSyntax) {
      const hasDefault = exports.some((e) => e.type !== "reexport-all" && e.name === "default");
      return `export * from ${id};${hasDefault ? `export { default } from ${id};` : ""}`;
    }
    const names = (await cjsExportNames(file)).filter((k) => IDENT.test(k) && k !== "default" && k !== "__esModule");
    return `import __m from ${id}; export default __m; export const { ${names.join(", ")} } = __m;`;
  }
}
