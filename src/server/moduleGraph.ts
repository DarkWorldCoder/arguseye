import { readFile } from "node:fs/promises";
import { join as pathJoin } from "node:path";
import type { ResolverFactory } from "oxc-resolver";
import { transform } from "oxc-transform";
import { init, parse } from "es-module-lexer";
import type { DepBundler } from "./depBundler.js";
import { isStylesheet, type CssPipeline } from "./cssPipeline.js";
import { assetModule, importsImagesAsObjects } from "./assets.js";
import { isShim, shimFor } from "./shims.js";
import { createResolver } from "./resolver.js";

const SCRIPT_EXT = /\.(m|c)?(j|t)sx?$/;

/** Turns project files into browser ESM the preview page can import directly. */
export class ModuleGraph {
  private resolver: ResolverFactory = createResolver();
  private boundaries = new Set<string>();
  private imagesAsObjects: boolean;
  /** Project files each module imports, from its last load; feeds `crawl`. */
  private projectImports = new Map<string, string[]>();

  constructor(
    private readSource: (file: string) => Promise<string>,
    private deps: DepBundler,
    /** Cache-busting query for a file's current version, e.g. `?e=0&v=2`. */
    private query: (file: string) => string,
    private css: CssPipeline,
    private root: string,
  ) {
    this.imagesAsObjects = importsImagesAsObjects(root);
  }

  /** True when the module only registers components, so Fast Refresh can swap it in place. */
  isRefreshBoundary(file: string): boolean {
    return this.boundaries.has(file);
  }

  /**
   * Loads `file` and everything it imports from the project, so every npm package it needs is known
   * (and can be bundled once) before the page loads anything.
   */
  async crawl(file: string, seen = new Set<string>()): Promise<void> {
    if (seen.has(file) || !SCRIPT_EXT.test(file)) return;
    seen.add(file);
    try {
      await this.load(file);
    } catch {
      return; // the error is reported when the page requests the module
    }
    for (const dep of this.projectImports.get(file) ?? []) await this.crawl(dep, seen);
  }

  /** Loads a generated module's project imports, so the packages behind them are known before the first paint. */
  async crawlVirtual(asFile: string, source: string): Promise<void> {
    try {
      await this.loadVirtual(asFile, source);
    } catch {
      return;
    }
    const seen = new Set<string>();
    for (const dep of this.projectImports.get(asFile) ?? []) await this.crawl(dep, seen);
  }

  /** A generated module that resolves its imports as if it lived at `asFile` (e.g. next to the root layout). */
  async loadVirtual(asFile: string, source: string): Promise<string> {
    const { code, errors } = await transform(asFile, source, { sourceType: "module", jsx: { runtime: "automatic", development: true, refresh: true } });
    if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
    return this.rewriteImports(asFile, this.withRefresh(asFile, code));
  }

  async load(file: string): Promise<string> {
    if (!SCRIPT_EXT.test(file) && !isStylesheet(file)) return assetModule(file, this.imagesAsObjects);
    const source = await this.readSource(file);
    if (isStylesheet(file)) return cssModule(file, await this.css.process(file, source));
    const { code, errors } = await transform(file, source, {
      sourceType: "module",
      jsx: { runtime: "automatic", development: true, refresh: true },
    });
    if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
    return this.rewriteImports(file, this.withRefresh(file, code));
  }

  /** Lets React Fast Refresh swap this module's components in place, keeping their state. */
  private withRefresh(file: string, code: string): string {
    if (!code.includes("$RefreshReg$")) {
      this.boundaries.delete(file);
      return code;
    }
    this.boundaries.add(file);
    this.deps.add("react-refresh/runtime");
    const id = JSON.stringify(file);
    return [
      `import __RR from "/@deps/react-refresh/runtime.js";`,
      `const __prevReg = window.$RefreshReg$, __prevSig = window.$RefreshSig$;`,
      `window.$RefreshReg$ = (type, name) => __RR.register(type, ${id} + " " + name);`,
      `window.$RefreshSig$ = __RR.createSignatureFunctionForTransform;`,
      code,
      `window.$RefreshReg$ = __prevReg; window.$RefreshSig$ = __prevSig;`,
    ].join("\n");
  }

  private async rewriteImports(file: string, code: string): Promise<string> {
    await init;
    const [imports] = parse(code, file);
    let out = "";
    let last = 0;
    const project: string[] = [];
    for (const imp of imports) {
      if (imp.type === "import-meta" || imp.specifier === undefined) continue;
      const url = this.urlFor(file, imp.specifier);
      if (url.startsWith("/@fs")) project.push(decodeURIComponent(url.slice(4).split("?")[0]));
      out += code.slice(last, imp.start) + url;
      last = imp.end;
    }
    this.projectImports.set(file, project);
    return out + code.slice(last);
  }

  private urlFor(importer: string, specifier: string): string {
    if (specifier.startsWith("/@")) return specifier;
    const shim = shimFor(specifier);
    if (shim) return `/@fs${shim}${this.query(shim)}`;
    // Shims live in this package but must use the project's react, so they resolve from the project root.
    const from = isShim(importer) ? pathJoin(this.root, "index.js") : importer;
    const { path, error } = this.resolver.resolveFileSync(from, specifier);
    if (!path) throw new Error(`Cannot resolve "${specifier}" from ${importer}: ${error}`);
    if (path.includes("/node_modules/")) {
      this.deps.add(specifier);
      return `/@deps/${specifier}.js`;
    }
    const query = this.query(path);
    return SCRIPT_EXT.test(path) ? `/@fs${path}${query}` : `/@fs${path}?import&${query.slice(1)}`;
  }
}

/** A stylesheet as a JS module: injects (or replaces) its <style>; CSS modules also export their class map. */
function cssModule(file: string, { css, classes }: { css: string; classes?: Record<string, string> }): string {
  const id = JSON.stringify(file);
  return [
    `let style = document.querySelector(\`style[data-file=\${JSON.stringify(${id})}]\`);`,
    `if (!style) { style = document.createElement("style"); style.dataset.file = ${id}; document.head.append(style); }`,
    `style.textContent = ${JSON.stringify(css)};`,
    classes ? `export default ${JSON.stringify(classes)};` : "",
  ].join("\n");
}

export const readFromDisk = (file: string) => readFile(file, "utf8");
