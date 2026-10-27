import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transform as transformCss } from "lightningcss";
import { rewriteCssUrls } from "./assets.js";

type TailwindNode = typeof import("@tailwindcss/node");
type TailwindOxide = typeof import("@tailwindcss/oxide");
type TailwindSheet = {
  source: string;
  compiler: Awaited<ReturnType<TailwindNode["compile"]>>;
  scanner: InstanceType<TailwindOxide["Scanner"]>;
  candidates: Set<string>;
};

const TAILWIND_V4 = /@import\s+["']tailwindcss["']|@import\s+["']tailwindcss\/|@tailwind\s+utilities|@theme\b/;
const ownRequire = createRequire(import.meta.url);

/**
 * Turns stylesheets into the CSS the app would ship: Tailwind v4 compiled with the project's own
 * Tailwind and theme, CSS modules scoped by Lightning CSS, everything else as written.
 */
export class CssPipeline {
  private sheets = new Map<string, TailwindSheet>();
  private tailwind: Promise<{ node: TailwindNode; oxide: TailwindOxide }> | undefined;

  constructor(private root: string) {}

  async process(file: string, source: string): Promise<{ css: string; classes?: Record<string, string> }> {
    const { css, classes } = await this.compile(file, source);
    return { css: rewriteCssUrls(css, file), classes };
  }

  private async compile(file: string, source: string): Promise<{ css: string; classes?: Record<string, string> }> {
    if (/\.module\.css$/.test(file)) {
      const result = transformCss({ filename: file, code: Buffer.from(source), cssModules: true });
      const classes = Object.fromEntries(
        Object.entries(result.exports ?? {}).map(([name, e]) => [name, [e.name, ...e.composes.map((c) => c.name)].join(" ")]),
      );
      return { css: result.code.toString(), classes };
    }
    if (TAILWIND_V4.test(source)) return { css: await this.buildTailwind(file, source) };
    return { css: source };
  }

  /**
   * Feeds an edited source file's contents to every Tailwind sheet; returns the sheets that gained classes
   * (they need re-sending to the page).
   */
  sourceChanged(file: string, content: string): string[] {
    const extension = path.extname(file).slice(1);
    const stale: string[] = [];
    for (const [sheetFile, sheet] of this.sheets) {
      const found = sheet.scanner.scanFiles([{ content, extension }]);
      const fresh = found.filter((c) => !sheet.candidates.has(c));
      if (!fresh.length) continue;
      fresh.forEach((c) => sheet.candidates.add(c));
      stale.push(sheetFile);
    }
    return stale;
  }

  private async buildTailwind(file: string, source: string): Promise<string> {
    let sheet = this.sheets.get(file);
    if (!sheet || sheet.source !== source) {
      const { node, oxide } = await this.loadTailwind();
      const compiler = await node.compile(source, { base: path.dirname(file), from: file, onDependency: () => {} });
      const sources =
        compiler.root === "none"
          ? []
          : [{ ...(compiler.root ?? { base: this.root, pattern: "**/*" }), negated: false }];
      const scanner = new oxide.Scanner({ sources: [...sources, ...compiler.sources] });
      sheet = { source, compiler, scanner, candidates: new Set([...(sheet?.candidates ?? []), ...scanner.scan()]) };
      this.sheets.set(file, sheet);
    }
    return sheet.compiler.build([...sheet.candidates]);
  }

  /** Prefers the project's own Tailwind so output matches the app byte for byte; falls back to ours. */
  private loadTailwind() {
    this.tailwind ??= (async () => {
      const projectRequire = createRequire(path.join(this.root, "package.json"));
      const load = async (name: string) => {
        let resolved: string;
        try {
          resolved = projectRequire.resolve(name);
        } catch {
          resolved = ownRequire.resolve(name);
        }
        return import(pathToFileURL(resolved).href);
      };
      return { node: await load("@tailwindcss/node"), oxide: await load("@tailwindcss/oxide") };
    })();
    return this.tailwind;
  }
}
