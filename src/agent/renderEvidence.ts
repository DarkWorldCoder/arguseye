import type { RenderResult } from "./createRenderer.js";
import type { DiffResult } from "./compareCaptures.js";

/** Machine-readable render metadata, shared by MCP, CLI and the editor without PNG byte arrays. */
export function renderEvidence({ png: _png, ...evidence }: RenderResult) { return evidence; }

/** Machine-readable comparison metadata; image files travel separately from the token-cheap evidence. */
export function diffEvidence({ before, after, diffPng: _png, ...evidence }: DiffResult) {
  return { ...evidence, before: renderEvidence(before), after: renderEvidence(after) };
}
