import { existsSync, readFileSync } from "node:fs";
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
const POSTCSS_CONFIGS = ["postcss.config.js", "postcss.config.mjs", "postcss.config.cjs", "postcss.config.ts", ".postcssrc.json"];
const ownRequire = createRequire(import.meta.url);

/** Stylesheets the preview compiles (as opposed to assets it serves as files). */
export const isStylesheet = (file: string) => /\.(css|scss|sass)$/.test(file);

/**
 * Turns stylesheets into the CSS the app would ship: Tailwind v4 compiled with the project's own
 * Tailwind and theme, CSS modules scoped by Lightning CSS, everything else as written.
 */
export class CssPipeline {
  private sheets = new Map<string, TailwindSheet>();
  private tailwind: Promise<{ node: TailwindNode; oxide: TailwindOxide }> | undefined;
  private postcss: Promise<((css: string, from: string) => Promise<string>) | undefined> | undefined;
  private projectRequire: NodeJS.Require;
  private tailwindMajor: number | undefined;

  constructor(private root: string) {
    this.projectRequire = createRequire(path.join(root, "package.json"));
    try {
      this.tailwindMajor = Number(JSON.parse(readFileSync(this.projectRequire.resolve("tailwindcss/package.json"), "utf8")).version.split(".")[0]);
    } catch {
      this.tailwindMajor = undefined;
    }
  }

  async process(file: string, source: string): Promise<{ css: string; classes?: Record<string, string> }> {
    const { css, classes } = await this.compile(file, source);
    return { css: rewriteCssUrls(css, file), classes };
  }

  /** Same order as the app's bundler: Sass → Tailwind v4 or the project's PostCSS → CSS modules. */
  private async compile(file: string, source: string): Promise<{ css: string; classes?: Record<string, string> }> {
    let css = /\.(scss|sass)$/.test(file) ? await this.sass(file, source) : source;
    if (this.tailwindMajor !== undefined && this.tailwindMajor >= 4 && TAILWIND_V4.test(css)) {
      css = await this.buildTailwind(file, css);
    } else {
      const postcss = await this.loadPostcss();
      if (postcss) css = await postcss(css, file);
    }
    if (/\.module\.(css|scss|sass)$/.test(file)) {
      const result = transformCss({ filename: file, code: Buffer.from(css), cssModules: true });
      const classes = Object.fromEntries(
        Object.entries(result.exports ?? {}).map(([name, e]) => [name, [e.name, ...e.composes.map((c) => c.name)].join(" ")]),
      );
      return { css: result.code.toString(), classes };
    }
    return { css };
  }

  /** Compiles with the project's own `sass` / `sass-embedded`. */
  private async sass(file: string, source: string): Promise<string> {
    const sass = await this.importFromProject("sass").catch(() => this.importFromProject("sass-embedded"));
    const result = await sass.compileStringAsync(source, {
      url: pathToFileURL(file),
      syntax: file.endsWith(".sass") ? "indented" : "scss",
      loadPaths: [path.dirname(file), path.join(this.root, "node_modules")],
    });
    return result.css;
  }

  /** The project's PostCSS with its own config, so Tailwind v3, autoprefixer and friends run as in the app. */
  private loadPostcss() {
    this.postcss ??= (async () => {
      const configFile = POSTCSS_CONFIGS.map((f) => path.join(this.root, f)).find((f) => existsSync(f));
      if (!configFile) return undefined;
      const postcss = (await this.importFromProject("postcss")).default;
      const config = configFile.endsWith(".json")
        ? JSON.parse(readFileSync(configFile, "utf8"))
        : (await import(pathToFileURL(configFile).href)).default;
      const declared = typeof config === "function" ? config({ env: "development" }) : config;
      const plugins = Array.isArray(declared.plugins)
        ? declared.plugins
        : await Promise.all(
            Object.entries(declared.plugins ?? {})
              .filter(([, options]) => options !== false)
              .map(async ([name, options]) => {
                const plugin = (await this.importFromProject(name)).default;
                return plugin(options === true ? {} : options);
              }),
          );
      const processor = postcss(plugins);
      const cwd = process.cwd();
      return async (css: string, from: string) => {
        // Tailwind v3 resolves `content` globs against the working directory.
        process.chdir(this.root);
        try {
          return (await processor.process(css, { from })).css;
        } finally {
          process.chdir(cwd);
        }
      };
    })();
    return this.postcss;
  }

  private async importFromProject(name: string): Promise<any> {
    return import(pathToFileURL(this.projectRequire.resolve(name)).href);
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
    // v4 is compiled directly (not through PostCSS) so classes from unsaved edits can be added.
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
