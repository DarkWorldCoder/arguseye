import { builtinModules, createRequire } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { rolldown } from "rolldown";
import { ResolverFactory } from "oxc-resolver";
import { init, parse } from "es-module-lexer";

const FACADE = "\0facade:";
/** Bump when the bundle output format changes, so stale on-disk bundles are not reused. */
const BUNDLER_VERSION = 1;
const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"];
// CommonJS on purpose: named imports from it become `undefined` at runtime instead of a build-time missing-export error.
const EMPTY = "\0node-builtin-empty.cjs";
/** Node built-ins have no browser equivalent; packages that reach them get an empty module, as bundlers do. */
const NODE_BUILTINS = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
const ownRequire = createRequire(import.meta.url);
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

  constructor(private root: string) {
    this.cacheDir = path.join(root, "node_modules", ".component-preview", "deps");
    // Temp folders left by a process that died mid-write.
    try {
      for (const name of readdirSync(this.cacheDir)) if (/\.\d+$/.test(name)) rmSync(path.join(this.cacheDir, name), { recursive: true, force: true });
    } catch {}
  }

  add(specifier: string) {
    this.wanted.add(specifier);
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

  async ensureBuilt() {
    while ([...this.wanted].some((s) => !this.built.has(s))) {
      this.building ??= this.build().finally(() => (this.building = undefined));
      await this.building;
    }
  }

  private async build() {
    const specs = [...this.wanted].sort();
    const key = this.cacheKey(specs);
    const dir = path.join(this.cacheDir, key);
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
    const hash = createHash("sha1").update(`${BUNDLER_VERSION}|${DepBundler.rolldownVersion}|${specs.join(",")}`);
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
      resolve: { alias: OWN },
      transform: { define: { "process.env.NODE_ENV": '"development"' } },
      plugins: [
        {
          name: "facades",
          resolveId: (id) => (id.startsWith(FACADE) ? id : NODE_BUILTINS.has(id) ? EMPTY : null),
          load: (id) => (id.startsWith(FACADE) ? facades.get(id.slice(FACADE.length)) : id === EMPTY ? "module.exports = {};" : null),
        },
      ],
    });
    const { output } = await bundle.generate({
      format: "esm",
      entryFileNames: "[name].js",
      chunkFileNames: "_chunk-[hash].js",
    });
    await bundle.close();
    this.files = new Map(output.flatMap((o) => (o.type === "chunk" ? [[o.fileName, o.code] as const] : [])));
    specs.forEach((s) => this.built.add(s));
    this.generation++;
  }

  /**
   * Re-exports a package so CommonJS packages (like React) expose their named exports.
   * ESM vs CommonJS is decided from the file the bundler will actually use (packages like MUI ship ESM at
   * the root and CommonJS under `main`), by its syntax rather than by package.json metadata.
   */
  private async facade(spec: string): Promise<string> {
    const id = JSON.stringify(spec);
    const file = OWN[spec] ?? this.resolver.resolveFileSync(path.join(this.root, "index.js"), spec).path;
    if (!file) throw new Error(`Cannot resolve package "${spec}" from ${this.root}`);
    await init;
    const [, exports, , hasModuleSyntax] = parse(readFileSync(file, "utf8"));
    if (hasModuleSyntax) {
      const hasDefault = exports.some((e) => e.type !== "reexport-all" && e.name === "default");
      return `export * from ${id};${hasDefault ? `export { default } from ${id};` : ""}`;
    }
    const names = Object.keys(createRequire(file)(file)).filter((k) => IDENT.test(k) && k !== "default" && k !== "__esModule");
    return `import __m from ${id}; export default __m; export const { ${names.join(", ")} } = __m;`;
  }
}
