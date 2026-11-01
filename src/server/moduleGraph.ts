import { fileUrl, fileFromUrl } from "./fileUrl.js";
import { compileHtml } from "./compileHtml.js";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
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
import { applyAlias, readViteConfig, type ViteConfig } from "../project/viteConfig.js";
import { nextFontUrl } from "./nextFont.js";
import { readKitConfig, type KitConfig } from "../project/svelteKit.js";
import { autoImportLines, readAutoImports } from "../project/autoImports.js";
import { jsxRuntimeOf } from "../project/framework.js";
import { createSolidCompiler } from "./createSolidCompiler.js";
import { expandImportGlobs } from "./importGlob.js";

const SCRIPT_EXT = /\.(?:(m|c)?(j|t)sx?|vue|svelte|html)$/;

/** Turns project files into browser ESM the preview page can import directly. */
export class ModuleGraph {
  private resolver: ResolverFactory = createResolver();
  /** Aliases from the project's vite.config (tsconfig paths are handled by the resolver). */
  readonly vite: ViteConfig;
  /** SvelteKit's `$lib`, `kit.alias` and env prefix, when the project uses Kit. */
  readonly kit: KitConfig;
  private boundaries = new Set<string>();
  private imagesAsObjects: boolean;
  /** React Fast Refresh only where React is: in a Vue or Svelte project, a `useX` composable is not a hook. */
  private react: boolean;
  /** "preact" when the project renders JSX with Preact. */
  readonly jsx: "react" | "preact" | "solid";
  /** The project depends on vue: its .tsx files are Vue JSX unless React is installed too. */
  private vueProject: boolean;
  private solid: ReturnType<typeof createSolidCompiler>;
  private vue: ReturnType<typeof createVueCompiler>;
  private svelte: ReturnType<typeof createSvelteCompiler>;
  private transformed = new Map<string, { source: string; code: string; map?: any; prefix?: number; revision?: string }>();
  /** Project files each module imports, from its last load; feeds `crawl`. */
  private htmlScripts = new Map<string, { file: string; source: string }>();
  private projectImports = new Map<string, string[]>();
  /** Every import URL a module was served with (project and package), for `reachableUrls`. */
  private importUrls = new Map<string, string[]>();
  private rewritten = new Map<string, { input: string; output: string; edits: Array<{ start: number; end: number; delta: number; originalStart: number }> }>();
  private approximationWarnings = new Map<string, string[]>();
  /** File → version query it was last crawled at. */
  private crawled = new Map<string, string>();

  constructor(
    private readSource: (file: string) => Promise<string>,
    private deps: DepBundler,
    /** Cache-busting query for a file's current version, e.g. `?e=0&v=2`. */
    private query: (file: string) => string,
    private css: CssPipeline,
    private root: string,
    sourceFs?: { fileExists(file: string): boolean; readFile(file: string): string },
  ) {
    this.vite = readViteConfig(root);
    this.kit = readKitConfig(root);
    this.vue = createVueCompiler(root, css, sourceFs);
    this.svelte = createSvelteCompiler(root, css);
    this.imagesAsObjects = importsImagesAsObjects(root);
    this.react = Boolean(this.resolver.resolveFileSync(pathJoin(root, "package.json"), "react").path);
    this.jsx = jsxRuntimeOf(root);
    this.vueProject = Boolean(this.resolver.resolveFileSync(pathJoin(root, "package.json"), "vue").path);
    this.solid = createSolidCompiler(root);
  }

  /** Project dependencies reachable from a target's last transform, for scoped provenance and diagnostics. */
  filesFor(file: string, seen = new Set<string>()): string[] {
    if (seen.has(file)) return [];
    seen.add(file);
    return [file, ...(this.projectImports.get(file) ?? []).flatMap((dep) => this.filesFor(dep, seen))];
  }

  /** Maps only transforms whose original input is preserved; unavailable compiler chains return null. */
  sourceLocation(file: string, line: number, column: number): { file: string; line: number; column: number } | null {
    const cached = this.transformed.get(file), rewritten = this.rewritten.get(file);
    if (!cached?.map || !rewritten) return null;
    const lines = rewritten.output.split("\n");
    if (line < 1 || line > lines.length || column < 1) return null;
    let offset = lines.slice(0, line - 1).reduce((n, value) => n + value.length + 1, 0) + column - 1;
    const generatedOffset = offset;
    for (const edit of rewritten.edits) {
      if (generatedOffset >= edit.end) offset -= edit.delta;
      else if (generatedOffset >= edit.start) { offset = edit.originalStart; break; }
      else break;
    }
    const prefix = rewritten.input.slice(0, offset), inputLine = prefix.split("\n").length - (cached.prefix ?? 0);
    if (inputLine < 1) return null;
    const location = originalPositionFor(new TraceMap(cached.map), { line: inputLine, column: offset - prefix.lastIndexOf("\n") - 1 });
    return location.line === null || location.column === null ? null : { file, line: location.line, column: location.column + 1 };
  }

  /** Retains unsupported virtual-import evidence across browser module caching and warm renders. */
  warningsFor(file?: string): string[] {
    return file ? this.approximationWarnings.get(file) ?? [] : [...this.approximationWarnings.values()].flat();
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
        if (url.startsWith("/@fs")) walk(fileFromUrl(url.slice(4).split("?")[0]));
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
  async crawlVirtual(asFile: string, source: string, options?: { refresh?: boolean }): Promise<void> {
    try {
      await this.loadVirtual(asFile, source, options);
    } catch {
      return;
    }
    const seen = new Set<string>();
    for (const dep of this.projectImports.get(asFile) ?? []) await this.crawl(dep, seen);
  }

  /** A generated module that resolves its imports as if it lived at `asFile` (e.g. next to the root layout). */
  async loadVirtual(asFile: string, source: string, { refresh = true } = {}): Promise<string> {
    const { code, errors } = await transform(asFile, source, { sourceType: "module", jsx: { runtime: "automatic", development: true, refresh: refresh && this.jsx === "react", ...(this.jsx === "preact" ? { importSource: "preact" } : {}) } });
    if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
    return this.rewriteImports(asFile, refresh && this.jsx === "react" ? this.withRefresh(asFile, code) : code);
  }

  /** Inline modules are selected from the actual bounded HTML source, never supplied through HTTP text. */
  async loadHtmlScript(file: string, index: number): Promise<string> {
    await this.load(file);
    const script = this.htmlScripts.get(`${file}:${index}`);
    if (!script) throw new Error(`Unknown inline module ${index} in ${file}`);
    return this.loadVirtual(script.file, script.source, { refresh: false });
  }

  async load(file: string): Promise<string> {
    if (file.endsWith(".html")) {
      const source = await this.readSource(file);
      const inline: Array<{ file: string; source: string; url: string }> = [];
      const document = compileHtml(file, source, (specifier) => {
        if (specifier.startsWith("/")) specifier = pathJoin(this.root, "public", specifier);
        return this.urlFor(file, specifier);
      }, (index, source) => {
        const script = { file: file + `.inline-${index}.ts`, source, url: `/@html-script?file=${encodeURIComponent(file)}&index=${index}&e=${encodeURIComponent(this.query(file))}` };
        this.htmlScripts.set(`${file}:${index}`, script); inline.push(script); return script.url;
      });
      for (const script of inline) await this.crawlVirtual(script.file, script.source, { refresh: false });
      const urls = [...document.scripts.map((s) => s.url), ...document.styles];
      this.projectImports.set(file, [...urls.filter((url) => url.startsWith("/@fs/")).map((url) => fileFromUrl(url.slice(4).split("?")[0])), ...inline.flatMap((script) => this.projectImports.get(script.file) ?? [])]);
      this.importUrls.set(file, [...urls, ...inline.flatMap((script) => this.importUrls.get(script.file) ?? [])]);
      return `export default ${JSON.stringify(document)};`;
    }
    if (file.endsWith(".json")) return jsonModule(file, await this.readSource(file));
    if (!SCRIPT_EXT.test(file) && !isStylesheet(file)) return assetModule(file, this.imagesAsObjects);

    const source = await this.readSource(file);
    if (isStylesheet(file)) return cssModule(file, await this.css.process(file, source));
    let cached = this.transformed.get(file);
    if (!cached || cached.source !== source || file.endsWith(".vue") && cached.revision !== this.query(file)) {
      const vue = file.endsWith(".vue"), svelte = file.endsWith(".svelte"), sfc = vue || svelte;
      const input = vue ? await this.vue.compile(file, source, this.query(file)) : svelte ? await this.svelte.compile(file, source) : source;
      const modular = expandImportGlobs(file, sfc ? input : modularizeBarrelImports(file, input, this.resolver), this.root, [...this.vite.aliases, ...this.kit.aliases]);
      const refresh = !sfc && this.react && !/[\\/]shims[\\/](nuxt|sveltekit)[\\/]/.test(file);
      // Solid's JSX compiles to DOM code with its own Babel preset; other files go through oxc as usual.
      const solidJsx = this.jsx === "solid" && /\.[jt]sx$/.test(file) && !/[\\/]node_modules[\\/]/.test(file);
      // <script lang="tsx"> in a .vue file (and .tsx files in a Vue project) is Vue JSX: Vue's own jsx-runtime renders it.
      const vueJsx = (vue && /<script\b[^>]*\blang=["'](tsx|jsx)["']/.test(source)) || (this.vueProject && /\.[jt]sx$/.test(file) && !this.react);
      const importSource = this.jsx === "preact" ? "preact" : vueJsx ? "vue" : undefined;
      const { code, errors, map } = solidJsx ? { map: undefined, code: await this.solid.compile(file, modular), errors: [] } : await transform(vue ? file + (vueJsx ? ".tsx" : ".ts") : svelte ? file + ".js" : file, modular, {
        // JSX in .js files is common (Create React App, older Vite and webpack setups): parse plain JS as JSX.
        ...(/\.(m|c)?js$/.test(file) && !sfc ? { lang: "jsx" as const } : {}),
        sourceType: "module", sourcemap: !sfc && modular === source, jsx: { runtime: "automatic", development: true, refresh: refresh && !vueJsx, ...(importSource ? { importSource } : {}) },
      });
      if (errors.length) throw new Error(errors.map((e) => `${file}: ${e.message}`).join("\n"));
      // Vite exposes env through import.meta.env; the page holds the values, each module that reads them gets them.
      const env = code.includes("import.meta.env") ? "import.meta.env = window.__CP__.metaEnv;\n" : "";
      // Names an auto-import tool (unplugin-auto-import, Nuxt) provides without an import statement.
      const auto = /[\\/]node_modules[\\/]/.test(file) ? [] : autoImportLines(file, code, readAutoImports(this.root));
      const head = env + (auto.length ? auto.join("\n") + "\n" : "");
      cached = { source, map, revision: this.query(file), prefix: head.split("\n").length - 1 + (refresh && code.includes("$RefreshReg$") ? 4 : 0), code: head + (refresh ? this.withRefresh(file, code) : code) };
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
    const warnings: string[] = [];
    const edits: Array<{ start: number; end: number; delta: number; originalStart: number }> = [];
    for (const imp of imports) {
      if (imp.type === "import-meta" || imp.specifier === undefined) continue;
      const statement = imp.type === "static" ? code.slice(imp.importStart, imp.importEnd) : "";
      const url = nextFontUrl(imp.specifier, file, statement) ?? virtualUrl(imp.specifier, statement) ?? this.urlFor(file, imp.specifier);
      urls.push(url);
      if (url.startsWith("/@virtual?")) warnings.push(`${imp.specifier} comes from a Vite plugin and is empty in a preview.`);
      if (url.startsWith("/@fs")) project.push(fileFromUrl(url.slice(4).split("?")[0]));
      // A dynamic import's span includes its quotes; a static import's does not.
      out += code.slice(last, imp.start);
      const text = imp.type === "dynamic" ? JSON.stringify(url) : url;
      edits.push({ start: out.length, end: out.length + text.length, delta: text.length - (imp.end - imp.start), originalStart: imp.start });
      out += text;
      last = imp.end;
    }
    this.projectImports.set(file, project);
    this.importUrls.set(file, urls);
    this.approximationWarnings.set(file, [...new Set(warnings)]);
    const output = out + code.slice(last);
    this.rewritten.set(file, { input: code, output, edits });
    return output;
  }

  private urlFor(importer: string, specifier: string): string {
    if (specifier.startsWith("/@")) return specifier;
    const shim = shimFor(specifier);
    if (shim) return `${fileUrl(shim)}${this.query(shim)}`;
    if (specifier === ROUTER_ALIAS) {
      const router = routerPackage(this.root);
      if (!router) throw new Error(`${importer}: @remix-run/react renders with react-router-dom 6.4+ or react-router 7; neither is installed in the project.`);
      return this.urlFor(importer, router);
    }
    // Shims live in this package but must use the project's react, so they resolve from the project root.
    const from = isShim(importer) ? pathJoin(this.root, "index.js") : importer;
    // SvelteKit's $env modules come from the project's env files, generated per page.
    if (this.kit.kit && specifier.startsWith("$env/")) return `/@sveltekit-env?m=${encodeURIComponent(specifier)}`;
    const aliased = isShim(importer) ? undefined : applyAlias(this.vite.aliases, specifier) ?? applyAlias(this.kit.aliases, specifier);
    const { path, error } = this.resolver.resolveFileSync(from, aliased ?? specifier);
    if (!path) throw new Error(`Cannot resolve "${specifier}" from ${importer.replaceAll("\\", "/")}: ${error}`);
    if (/[\\/]node_modules[\\/]/.test(path) && !isStylesheet(path)) {
      this.deps.add(specifier);
      return `/@deps/${specifier}.js`;
    }
    const query = this.query(path);
    return SCRIPT_EXT.test(path) ? `${fileUrl(path)}${query}` : `${fileUrl(path)}?import&${query.slice(1)}`;
  }
}

/**
 * A Vite plugin's virtual module (`virtual:svg-icons-register`, `virtual:pwa-register`) exists only inside that
 * plugin: the preview serves an empty stand-in with the names the import asks for, so one plugin import does not
 * stop the whole file (or the app setup in main.ts) from loading.
 */
function virtualUrl(specifier: string, statement: string): string | undefined {
  if (!specifier.startsWith("virtual:") && !specifier.startsWith("\0")) return undefined;
  const names = (statement.match(/\{([^}]*)\}/)?.[1] ?? "").split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
  return `/@virtual?${new URLSearchParams({ id: specifier, names: names.join(",") })}`;
}

/** A JSON import as bundlers serve it: the parsed value as the default export, top-level keys as named exports. */
function jsonModule(file: string, source: string): string {
  let value: unknown;
  try { value = JSON.parse(source); } catch (error) { throw new Error(`${file}: invalid JSON (${(error as Error).message})`); }
  const named = value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k) && !RESERVED.has(k)).map((k) => `export const ${k} = json[${JSON.stringify(k)}];`)
    : [];
  return [`const json = ${JSON.stringify(value)};`, "export default json;", ...named].join("\n");
}

const RESERVED = new Set("break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await".split(" "));

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
