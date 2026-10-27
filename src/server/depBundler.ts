import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { rolldown } from "rolldown";
import { ResolverFactory } from "oxc-resolver";
import { init, parse } from "es-module-lexer";

const FACADE = "\0facade:";
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
  private resolver = new ResolverFactory({
    conditionNames: ["browser", "import", "module", "default"],
    mainFields: ["browser", "module", "main"],
    moduleType: true,
  });

  constructor(private root: string) {}

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

  private async ensureBuilt() {
    while ([...this.wanted].some((s) => !this.built.has(s))) {
      this.building ??= this.build().finally(() => (this.building = undefined));
      await this.building;
    }
  }

  private async build() {
    const specs = [...this.wanted];
    const facades = new Map(await Promise.all(specs.map(async (s) => [s, await this.facade(s)] as const)));
    const bundle = await rolldown({
      input: Object.fromEntries(specs.map((s) => [s, FACADE + s])),
      cwd: this.root,
      platform: "browser",
      transform: { define: { "process.env.NODE_ENV": '"development"' } },
      plugins: [
        {
          name: "facades",
          resolveId: (id) => (id.startsWith(FACADE) ? id : null),
          load: (id) => (id.startsWith(FACADE) ? facades.get(id.slice(FACADE.length)) : null),
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
  }

  /** Re-exports a package so CommonJS packages (like React) expose their named exports. */
  private async facade(spec: string): Promise<string> {
    const target = this.resolver.resolveFileSync(path.join(this.root, "index.js"), spec);
    const id = JSON.stringify(spec);
    if (target.moduleType === "module" || /\.mjs$/.test(target.path ?? "")) {
      await init;
      const [, exports] = parse(readFileSync(target.path!, "utf8"));
      const hasDefault = exports.some((e) => e.type !== "reexport-all" && e.name === "default");
      return `export * from ${id};${hasDefault ? `export { default } from ${id};` : ""}`;
    }
    const names = Object.keys(createRequire(path.join(this.root, "index.js"))(spec)).filter(
      (k) => IDENT.test(k) && k !== "default" && k !== "__esModule",
    );
    return `import __m from ${id}; export default __m; export const { ${names.join(", ")} } = __m;`;
  }
}
