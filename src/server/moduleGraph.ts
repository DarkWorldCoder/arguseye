import { readFile } from "node:fs/promises";
import { ResolverFactory } from "oxc-resolver";
import { transform } from "oxc-transform";
import { init, parse } from "es-module-lexer";
import type { DepBundler } from "./depBundler.js";

const SCRIPT_EXT = /\.(m|c)?(j|t)sx?$/;

/** Turns project files into browser ESM the preview page can import directly. */
export class ModuleGraph {
  private resolver: ResolverFactory;

  constructor(
    private readSource: (file: string) => Promise<string>,
    private deps: DepBundler,
  ) {
    this.resolver = new ResolverFactory({
      tsconfig: "auto",
      conditionNames: ["browser", "import", "module", "default"],
      mainFields: ["browser", "module", "main"],
      extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    });
  }

  async load(file: string): Promise<string> {
    const source = await this.readSource(file);
    const { code, errors } = await transform(file, source, {
      sourceType: "module",
      jsx: { runtime: "automatic", development: true, refresh: true },
    });
    if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
    return this.rewriteImports(file, code);
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
    return SCRIPT_EXT.test(path) ? `/@fs${path}` : `/@fs${path}?import`;
  }
}

export const readFromDisk = (file: string) => readFile(file, "utf8");
