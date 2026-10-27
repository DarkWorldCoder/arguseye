import { readFile } from "node:fs/promises";
import type { ResolverFactory } from "oxc-resolver";
import { transform } from "oxc-transform";
import { init, parse } from "es-module-lexer";
import type { DepBundler } from "./depBundler.js";
import { createResolver } from "./resolver.js";

const SCRIPT_EXT = /\.(m|c)?(j|t)sx?$/;

/** Turns project files into browser ESM the preview page can import directly. */
export class ModuleGraph {
  private resolver: ResolverFactory = createResolver();
  private boundaries = new Set<string>();

  constructor(
    private readSource: (file: string) => Promise<string>,
    private deps: DepBundler,
    /** Cache-busting query for a file's current version, e.g. `?e=0&v=2`. */
    private query: (file: string) => string,
  ) {}

  /** True when the module only registers components, so Fast Refresh can swap it in place. */
  isRefreshBoundary(file: string): boolean {
    return this.boundaries.has(file);
  }

  async load(file: string): Promise<string> {
    const source = await this.readSource(file);
    if (file.endsWith(".css")) return cssModule(file, source);
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
    for (const imp of imports) {
      if (imp.type === "import-meta" || imp.specifier === undefined) continue;
      out += code.slice(last, imp.start) + this.urlFor(file, imp.specifier);
      last = imp.end;
    }
    return out + code.slice(last);
  }

  private urlFor(importer: string, specifier: string): string {
    if (specifier.startsWith("/@")) return specifier;
    const { path, error } = this.resolver.resolveFileSync(importer, specifier);
    if (!path) throw new Error(`Cannot resolve "${specifier}" from ${importer}: ${error}`);
    if (path.includes("/node_modules/")) {
      this.deps.add(specifier);
      return `/@deps/${specifier}.js`;
    }
    const query = this.query(path);
    return SCRIPT_EXT.test(path) ? `/@fs${path}${query}` : `/@fs${path}?import&${query.slice(1)}`;
  }
}

function cssModule(file: string, css: string): string {
  const id = JSON.stringify(file);
  return [
    `let style = document.querySelector(\`style[data-file=\${JSON.stringify(${id})}]\`);`,
    `if (!style) { style = document.createElement("style"); style.dataset.file = ${id}; document.head.append(style); }`,
    `style.textContent = ${JSON.stringify(css)};`,
  ].join("\n");
}

export const readFromDisk = (file: string) => readFile(file, "utf8");
