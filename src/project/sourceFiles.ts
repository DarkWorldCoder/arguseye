import { readdir } from "node:fs/promises";
import path from "node:path";

import { isTemplateFile } from "./templateEngines.js";

const SKIP = new Set([".venv", "venv", "vendor", ".bundle", ".runtime", "__pycache__", "node_modules", ".git", ".next", "dist", "build", "out", "coverage", ".turbo", ".cache", ".vscode-test", "dist-test", "public"]);
const SOURCE = /\.(?:[jt]sx?|vue|svelte|html)$/;

/** Every source file in the project that could be a component or import one. */
export async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return SKIP.has(e.name) ? [] : sourceFiles(full);
      return (SOURCE.test(e.name) || isTemplateFile(e.name)) && !/\.(test|spec|stories)\.|\.d\.ts$/.test(e.name) ? [full] : [];
    }),
  );
  return nested.flat();
}
