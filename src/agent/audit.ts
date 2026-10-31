import { readFile } from "node:fs/promises";
import path from "node:path";
import { sourceFiles } from "../project/sourceFiles.js";
import { pickExport } from "../project/pickExport.js";
import type { Renderer } from "./createRenderer.js";

export type AuditEntry = {
  file: string;
  export?: string;
  status: "ok" | "error" | "empty" | "skipped";
  ms?: number;
  errors?: string[];
  warnings?: string[];
  /** console.error output during the render, often the reason behind the error. */
  console?: string[];
};

export type AuditReport = { root: string; total: number; ok: number; error: number; empty: number; skipped: number; entries: AuditEntry[]; topErrors: Array<{ message: string; count: number }> };

/** Files that hold components: Vue and Svelte single-file components, and JSX/TSX modules outside test and config code. */
export async function componentFiles(dir: string): Promise<string[]> {
  const files = await sourceFiles(dir);
  return files.filter((f) => {
    const rel = "/" + path.relative(dir, f);
    return /\.(vue|svelte|[jt]sx)$/.test(f) && !/\/(vite|vitest|next|tailwind|postcss|eslint|playwright)\.config\./.test(rel) && !/\/(__tests__|__mocks__|e2e|fixtures?)\//.test(rel);
  }).sort();
}

/**
 * Renders every component in `dir` once with no input from the caller (sample props from types), so a refactor,
 * an upgrade or a new project can be checked in one command: what renders, what errors, what comes out empty.
 */
export async function audit(renderer: Renderer, root: string, dir = root, { limit = Infinity, onEntry = (_: AuditEntry) => {} } = {}): Promise<AuditReport> {
  const entries: AuditEntry[] = [];
  for (const file of (await componentFiles(dir)).slice(0, limit)) {
    const rel = path.relative(root, file);
    const exportName = /\.(vue|svelte)$/.test(file) ? "default" : pickExport(file, await readFile(file, "utf8"));
    if (!exportName) { const e: AuditEntry = { file: rel, status: "skipped", warnings: ["No component export"] }; entries.push(e); onEntry(e); continue; }
    let entry: AuditEntry;
    try {
      const result = await renderer.render({ file, exportName });
      const empty = result.warnings.some((w) => w.includes("rendered nothing visible"));
      const notComponent = result.errors.length === 1 && /is an object, not a component/.test(result.errors[0]);
      entry = {
        file: rel, export: exportName, ms: result.ms,
        status: notComponent ? "skipped" : result.errors.length ? "error" : empty ? "empty" : "ok",
        ...(result.errors.length ? { errors: result.errors.map(firstLine) } : {}),
        ...(result.warnings.length ? { warnings: result.warnings } : {}),
        ...(result.console?.length ? { console: result.console } : {}),
      };
    } catch (error) {
      entry = { file: rel, export: exportName, status: "error", errors: [firstLine(String((error as Error).message ?? error))] };
    }
    entries.push(entry);
    onEntry(entry);
  }
  const count = (s: AuditEntry["status"]) => entries.filter((e) => e.status === s).length;
  const tally = new Map<string, number>();
  for (const e of entries) for (const m of e.errors ?? []) { const key = m.replace(/\/[^\s"')]+/g, "…").slice(0, 160); tally.set(key, (tally.get(key) ?? 0) + 1); }
  return {
    root, total: entries.length, ok: count("ok"), error: count("error"), empty: count("empty"), skipped: count("skipped"), entries,
    topErrors: [...tally].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([message, count]) => ({ message, count })),
  };
}

/** The line that names the problem: skips blank lines and generic headers such as "Build failed with 2 errors:". */
const firstLine = (s: string) => s.split("\n").map((l) => l.trim()).find((l) => l && !/^(Build failed with \d+ errors?:?|errors?:)$/i.test(l))?.slice(0, 400) ?? s;
