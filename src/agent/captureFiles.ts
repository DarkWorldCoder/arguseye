import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RenderResult } from "./createRenderer.js";
import type { DiffResult } from "./compareCaptures.js";
import { renderEvidence, diffEvidence } from "./renderEvidence.js";

/** Persists a replayable CLI baseline explicitly, without writing to the user's source files. */
export async function saveCapture(directory: string, result: RenderResult): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "capture.png"), result.png);
  await writeFile(path.join(directory, "capture.json"), JSON.stringify({ version: 1, ...renderEvidence(result) }, null, 2));
}

/** Reads a baseline made by the CLI; incompatible or incomplete manifests fail with the exact path. */
export async function loadCapture(directory: string): Promise<RenderResult> {
  const file = path.join(directory, "capture.json");
  const value = JSON.parse(await readFile(file, "utf8"));
  if (value.version !== 1 || !value.target?.file || !value.viewport || !Array.isArray(value.errors) || !Array.isArray(value.warnings) || !Array.isArray(value.unresolved) || typeof value.snapshot !== "string" || typeof value.sourceRevision !== "string") throw new Error(`Invalid baseline "${file}"; capture a new baseline with shot --capture-dir.`);
  return { ...value, png: await readFile(path.join(directory, "capture.png")) };
}

/** Writes all three comparison images and JSON evidence to an explicitly chosen directory. */
export async function saveDiff(directory: string, result: DiffResult): Promise<void> {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(path.join(directory, "before.png"), result.before.png),
    writeFile(path.join(directory, "after.png"), result.after.png),
    writeFile(path.join(directory, "diff.png"), result.diffPng),
    writeFile(path.join(directory, "diff.json"), JSON.stringify(diffEvidence(result), null, 2)),
  ]);
}
