import { globSync } from "node:fs";
import path from "node:path";
import { applyAlias } from "../project/viteConfig.js";

const GLOB = /import\.meta\.glob(?:<[^>]*>)?\s*\(\s*(\[[^\]]*\]|(['"`])[^'"`]+\2)\s*(?:,\s*(\{[^}]*\}))?\s*\)/g;

/**
 * Vite's `import.meta.glob(pattern, { eager, import })`, expanded at load time into the object Vite produces: keys are
 * the matched paths (relative patterns keep "./x", others are root-relative "/src/x"), values are lazy imports or,
 * with `eager`, the modules themselves. Aliases in patterns resolve as the project's vite.config defines them.
 */
export function expandImportGlobs(file: string, code: string, root: string, aliases: Array<{ find: string; replacement: string }>): string {
  if (!code.includes("import.meta.glob")) return code;
  const hoisted: string[] = [];
  let n = 0;
  const out = code.replace(GLOB, (_match, patternSource: string, _q: string, optionsSource?: string) => {
    const patterns = [...patternSource.matchAll(/(['"`])([^'"`]+)\1/g)].map((m) => m[2]);
    const eager = /eager\s*:\s*true/.test(optionsSource ?? "");
    const pick = optionsSource?.match(/import\s*:\s*(['"`])([^'"`]+)\1/)?.[2];
    const absolute = (p: string) => {
      if (p.startsWith("./") || p.startsWith("../")) return path.resolve(path.dirname(file), p);
      if (p.startsWith("/")) return path.join(root, p);
      return applyAlias(aliases, p) ?? path.join(root, p);
    };
    const include = patterns.filter((p) => !p.startsWith("!")).map(absolute);
    const exclude = new Set(patterns.filter((p) => p.startsWith("!")).flatMap((p) => globSync(path.relative(root, absolute(p.slice(1))), { cwd: root })).map((f) => path.join(root, f)));
    const relativeKeys = patterns.every((p) => p.replace(/^!/, "").startsWith("."));
    const files = [...new Set(include.flatMap((p) => globSync(path.relative(root, p), { cwd: root, exclude: (f: any) => /node_modules/.test(String(f)) }).map((f) => path.join(root, f))))]
      .filter((f) => !exclude.has(f) && f !== file).sort();
    const entries = files.map((f) => {
      const rel = path.relative(path.dirname(file), f).split(path.sep).join("/");
      const key = relativeKeys ? (rel.startsWith(".") ? rel : "./" + rel) : "/" + path.relative(root, f).split(path.sep).join("/");
      if (eager) {
        const local = `__glob_${n++}`;
        hoisted.push(pick ? `import { ${pick === "default" ? "default" : pick} as ${local} } from ${JSON.stringify(f)};` : `import * as ${local} from ${JSON.stringify(f)};`);
        return `${JSON.stringify(key)}: ${local}`;
      }
      return `${JSON.stringify(key)}: () => import(${JSON.stringify(f)})${pick ? `.then((m) => m[${JSON.stringify(pick)}])` : ""}`;
    });
    return `({ ${entries.join(", ")} })`;
  });
  return hoisted.length ? hoisted.join("\n") + "\n" + out : out;
}
