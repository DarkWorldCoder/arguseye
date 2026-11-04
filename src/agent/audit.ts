import { statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { sourceFiles } from "../project/sourceFiles.js";
import { isTemplateFile } from "../project/templateEngines.js";
import { pickExport } from "../project/pickExport.js";
import type { Renderer } from "./createRenderer.js";
import type { RenderDiagnostic } from "./renderDiagnostics.js";

export type AuditEntry = {
  file: string;
  export?: string;
  status: "ok" | "error" | "empty" | "skipped";
  /** Mount status alone does not establish that context and inputs were complete. */
  complete?: boolean;
  unresolved?: string[];
  diagnostics?: RenderDiagnostic[];
  ms?: number;
  errors?: string[];
  warnings?: string[];
  /** console.error output during the render, often the reason behind the error. */
  console?: string[];
};

export type AuditReport = { root: string; total: number; ok: number; error: number; empty: number; skipped: number; complete: number; incomplete: number; entries: AuditEntry[]; available: number; nextCursor: string | null; cancelled: boolean; topErrors: Array<{ message: string; count: number }> };

/** Files that hold components: Vue and Svelte single-file components, and JSX/TSX modules outside test and config code. */
export async function componentFiles(dir: string): Promise<string[]> {
  const files = await sourceFiles(dir);
  return files.filter((f) => {
    const rel = "/" + path.relative(dir, f);
    return (/\.(vue|svelte|html|[jt]sx)$/.test(f) || isTemplateFile(f)) && !/\/(vite|vitest|next|tailwind|postcss|eslint|playwright)\.config\./.test(rel) && !/\/(__tests__|__mocks__|e2e|fixtures?)\//.test(rel);
  }).sort();
}

/**
 * Renders every component in `dir` once with no input from the caller (sample props from types), so a refactor,
 * an upgrade or a new project can be checked in one command: what renders, what errors, what comes out empty.
 */
export async function audit(renderer: Renderer, root: string, dir = root, { limit = 200, cursor, signal, onEntry = (_: AuditEntry) => {} }: { limit?: number; cursor?: string; signal?: AbortSignal; onEntry?: (entry: AuditEntry) => void } = {}): Promise<AuditReport> {
  renderer.server.assertAccess(dir);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("Audit limit must be between 1 and 500");
  const files = await componentFiles(dir);
  const fingerprint = createHash("sha256").update(JSON.stringify(files.map((file) => { const s = statSync(file); return [file, s.size, s.mtimeMs, renderer.server.version(file)]; }))).digest("hex");
  let offset = 0;
  if (cursor) {
    try {
      if (cursor.length > 4096) throw new Error();
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
      if (value.v !== 1 || value.root !== root || value.dir !== dir || value.fingerprint !== fingerprint || !Number.isSafeInteger(value.offset) || value.offset < 0 || value.offset >= files.length) throw new Error();
      offset = value.offset;
    } catch { throw new Error("Invalid or expired audit cursor; restart the audit after source changes, or use the same root and folder."); }
  }
  const entries: AuditEntry[] = [];
  let cancelled = false;
  for (const file of files.slice(offset, offset + limit)) {
    if (signal?.aborted) { cancelled = true; break; }
    const rel = path.relative(root, file);
    const exportName = (/\.(vue|svelte|html)$/.test(file) || isTemplateFile(file)) ? "default" : pickExport(file, await renderer.server.readSource(file));
    if (!exportName) { const e: AuditEntry = { file: rel, status: "skipped", warnings: ["No component export"] }; entries.push(e); onEntry(e); continue; }
    let entry: AuditEntry;
    try {
      const result = await renderer.render({ file, exportName }, { signal });
      const empty = result.warnings.some((w) => w.includes("rendered nothing visible"));
      const notComponent = result.errors.length === 1 && /is an object, not a component/.test(result.errors[0]);
      entry = {
        file: rel, export: exportName, ms: result.ms,
        status: notComponent ? "skipped" : result.errors.length ? "error" : empty ? "empty" : "ok",
        ...(!notComponent ? { complete: result.complete, unresolved: result.unresolved, diagnostics: result.diagnostics } : {}),
        ...(result.errors.length ? { errors: result.errors.map(firstLine) } : {}),
        ...(result.warnings.length ? { warnings: result.warnings } : {}),
        ...(result.console?.length ? { console: result.console } : {}),
      };
    } catch (error) {
      if (signal?.aborted) { cancelled = true; break; }
      entry = { file: rel, export: exportName, status: "error", complete: false, errors: [firstLine(String((error as Error).message ?? error))] };
    }
    entries.push(entry);
    onEntry(entry);
  }
  const count = (s: AuditEntry["status"]) => entries.filter((e) => e.status === s).length;
  const tally = new Map<string, number>();
  for (const e of entries) for (const m of e.errors ?? []) { const key = m.replace(/\/[^\s"')]+/g, "…").slice(0, 160); tally.set(key, (tally.get(key) ?? 0) + 1); }
  return {
    root, available: files.length, cancelled, nextCursor: offset + entries.length < files.length ? Buffer.from(JSON.stringify({ v: 1, root, dir, fingerprint, offset: offset + entries.length })).toString("base64url") : null, total: entries.length, ok: count("ok"), error: count("error"), empty: count("empty"), skipped: count("skipped"), entries,
    complete: entries.filter((entry) => entry.complete === true).length,
    incomplete: entries.filter((entry) => entry.complete === false).length,
    topErrors: [...tally].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([message, count]) => ({ message, count })),
  };
}

/** The line that names the problem: skips blank lines and generic headers such as "Build failed with 2 errors:". */
const firstLine = (s: string) => s.split("\n").map((l) => l.trim()).find((l) => l && !/^(Build failed with \d+ errors?:?|errors?:)$/i.test(l))?.slice(0, 400) ?? s;
