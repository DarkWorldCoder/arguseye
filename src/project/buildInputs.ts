import { statSync } from "node:fs";
import path from "node:path";

const NAMES = ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "tsconfig.json", "jsconfig.json", ".env", ".env.local", ".env.development", ".env.development.local", ...["vite.config", "postcss.config", "tailwind.config", "svelte.config", "next.config", "arguseye.setup", "arguseye.setup.vue"].flatMap((name) => ["ts", "mts", "js", "mjs", "cjs", "tsx", "jsx"].map((ext) => `${name}.${ext}`))];

/** Cheap per-render invalidation for manifests, lockfiles, build configs and explicit setup selection. */
export function buildInputs(root: string, dependencies: string[] = []): string {
  return JSON.stringify([...new Set([...NAMES.map((name) => path.join(root, name)), ...dependencies])].sort().map((file) => { const s = statSync(file, { throwIfNoEntry: false }); return [file, s?.mtimeMs, s?.size]; }));
}
