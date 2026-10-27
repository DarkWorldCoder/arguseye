import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Framework modules that cannot run outside their app, replaced by files in `shims/` with the same exports. */
const SHIMS: Record<string, string> = {
  "next/link": "next/link.tsx",
  "next/image": "next/image.tsx",
  "next/navigation": "next/navigation.ts",
};

/** `shims/` sits at the package root; this file runs from src/ in tests and from dist/ when bundled. */
export const SHIMS_DIR = (() => {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i++) {
    if (existsSync(path.join(dir, "shims"))) return path.join(dir, "shims");
    dir = path.dirname(dir);
  }
  throw new Error("shims/ directory not found");
})();

export const shimFor = (specifier: string): string | undefined =>
  SHIMS[specifier] ? path.join(SHIMS_DIR, SHIMS[specifier]) : undefined;

export const isShim = (file: string) => file.startsWith(SHIMS_DIR + path.sep);
