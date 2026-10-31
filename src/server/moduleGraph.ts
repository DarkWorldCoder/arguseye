import { createVueCompiler } from "./createVueCompiler.js";
import { createSvelteCompiler } from "./createSvelteCompiler.js";
import { readFile } from "node:fs/promises";
import { join as pathJoin } from "node:path";
import type { ResolverFactory } from "oxc-resolver";
import { transform } from "oxc-transform";
import { init, parse } from "es-module-lexer";
import type { DepBundler } from "./depBundler.js";
import { isStylesheet, type CssPipeline } from "./cssPipeline.js";
import { assetModule, importsImagesAsObjects } from "./assets.js";
import { isShim, shimFor, ROUTER_ALIAS } from "./shims.js";
import { routerPackage } from "../project/routerPackage.js";
import { modularizeBarrelImports } from "./modularize.js";
import { createResolver } from "./resolver.js";

const SCRIPT_EXT = /\.(?:(m|c)?(j|t)sx?|vue|svelte)$/;

/** Turns project files into browser ESM the preview page can import directly. */
export class ModuleGraph {
  private resolver: ResolverFactory = createResolver();
  private boundaries = new Set<string>();
  private imagesAsObjects: boolean;
  private vue: ReturnType<typeof createVueCompiler>;
  private svelte: ReturnType<typeof createSvelteCompiler>;
  private transformed = new Map<string, { source: string; code: string }>();
  /** Project files each module imports, from its last load; feeds `crawl`. */
  private projectImports = new Map<string, string[]>();
  /** Every import URL a module was served with (project and package), for `reachableUrls`. */
  private importUrls = new Map<string, string[]>();
  /** File → version query it was last crawled at. */
  private crawled = new Map<string, string>();

  constructor(
    private readSource: (file: string) => Promise<string>,
    private deps: DepBundler,
    /** Cache-busting query for a file's current version, e.g. `?e=0&v=2`. */
    private query: (file: string) => string,
    private css: CssPipeline,
    private root: string,
  ) {
    this.vue = createVueCompiler(root, css);
    this.svelte = createSvelteCompiler(root, css);
    this.imagesAsObjects = importsImagesAsObjects(root);
  }

  /** Project dependencies reachable from a target's last transform, for scoped provenance and diagnostics. */
  filesFor(file: string, seen = new Set<string>()): string[] {
    if (seen.has(file)) return [];
    seen.add(file);
    return [file, ...(this.projectImports.get(file) ?? []).flatMap((dep) => this.filesFor(dep, seen))];
  }

  /** Module URLs reachable from `file` (project files and the package entries they import), for modulepreload. */
  reachableUrls(file: string): string[] {
    const urls = new Set<string>();
    const seen = new Set<string>();
    const walk = (f: string) => {
      if (seen.has(f)) return;
      seen.add(f);
      for (const url of this.importUrls.get(f) ?? []) {
        urls.add(url);
        if (url.startsWith("/@fs")) walk(decodeURIComponent(url.slice(4).split("?")[0]));
      }
    };
    walk(file);
    return [...urls];
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
    // Each file version is transformed once: a project-wide crawl must not re-walk shared subgraphs per entry.
    const version = this.query(file);
    if (this.crawled.get(file) !== version) {
      try {
        await this.load(file);
      } catch {
        return; // the error is reported when the page requests the module
      }
      this.crawled.set(file, version);
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
    let cached = this.transformed.get(file);
    if (!cached || cached.source !== source) {
      const vue = file.endsWith(".vue"), svelte = file.endsWith(".svelte"), sfc = vue || svelte;
      const input = vue ? await this.vue.compile(file, source) : svelte ? await this.svelte.compile(file, source) : source;
      const modular = sfc ? input : modularizeBarrelImports(file, input, this.resolver);
      const { code, errors } = await transform(vue ? file + ".ts" : svelte ? file + ".js" : file, modular, {
        sourceType: "module", jsx: { runtime: "automatic", development: true, refresh: !sfc },
      });
      if (errors.length) throw new Error(errors.map((e) => `${file}: ${e.message}`).join("\n"));
      cached = { source, code: sfc ? code : this.withRefresh(file, code) };
      this.transformed.set(file, cached);
    }
    return this.rewriteImports(file, cached.code);
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
    const urls: string[] = [];
    for (const imp of imports) {
      if (imp.type === "import-meta" || imp.specifier === undefined) continue;
      const url = this.urlFor(file, imp.specifier);
      urls.push(url);
      if (url.startsWith("/@fs")) project.push(decodeURIComponent(url.slice(4).split("?")[0]));
      // A dynamic import's span includes its quotes; a static import's does not.
      out += code.slice(last, imp.start) + (imp.type === "dynamic" ? JSON.stringify(url) : url);
      last = imp.end;
    }
    this.projectImports.set(file, project);
    this.importUrls.set(file, urls);
    return out + code.slice(last);
  }

  private urlFor(importer: string, specifier: string): string {
    if (specifier.startsWith("/@")) return specifier;
    const shim = shimFor(specifier);
    if (shim) return `/@fs${shim}${this.query(shim)}`;
    if (specifier === ROUTER_ALIAS) {
      const router = routerPackage(this.root);
      if (!router) throw new Error(`${importer}: @remix-run/react renders with react-router-dom 6.4+ or react-router 7; neither is installed in the project.`);
      return this.urlFor(importer, router);
    }
    // Shims live in this package but must use the project's react, so they resolve from the project root.
    const from = isShim(importer) ? pathJoin(this.root, "index.js") : importer;
    const { path, error } = this.resolver.resolveFileSync(from, specifier);
    if (!path) throw new Error(`Cannot resolve "${specifier}" from ${importer}: ${error}`);
    if (path.includes("/node_modules/") && !isStylesheet(path)) {
      this.deps.add(specifier);
      return `/@deps/${specifier}.js`;
    }
    const query = this.query(path);
    return SCRIPT_EXT.test(path) ? `/@fs${path}${query}` : `/@fs${path}?import&${query.slice(1)}`;
  }
}

const FONT_FACE = /@font-face\s*\{[^{}]*\}/g;

/**
 * A stylesheet as a JS module: injects (or replaces) its <style>; CSS modules also export their class map.
 * @font-face rules live in their own <style>, rewritten only when they change: replacing a font rule makes the
 * browser create a new FontFace and reload it, which hides text (font-display: block) on every edit that
 * regenerates the stylesheet, such as a new Tailwind class.
 */
function cssModule(file: string, { css, classes }: { css: string; classes?: Record<string, string> }): string {
  const id = JSON.stringify(file);
  const fonts = (css.match(FONT_FACE) ?? []).join("\n");
  const rest = fonts ? css.replace(FONT_FACE, "") : css;
  return [
    `let style = document.querySelector(\`style[data-file=\${JSON.stringify(${id})}]\`);`,
    `if (!style) { style = document.createElement("style"); style.dataset.file = ${id}; document.head.append(style); }`,
    `let fonts = document.querySelector(\`style[data-fonts=\${JSON.stringify(${id})}]\`);`,
    `const fontCss = ${JSON.stringify(fonts)};`,
    `if (fontCss) {`,
    `  if (!fonts) { fonts = document.createElement("style"); fonts.dataset.fonts = ${id}; style.before(fonts); }`,
    `  if (fonts.textContent !== fontCss) fonts.textContent = fontCss;`,
    `} else fonts?.remove();`,
    `const css = ${JSON.stringify(rest)};`,
    `if (style.textContent !== css) style.textContent = css;`,
    classes ? `export default ${JSON.stringify(classes)};` : "",
  ].join("\n");
}

export const readFromDisk = (file: string) => readFile(file, "utf8");
