import type { RenderResult } from "./createRenderer.js";
import type { DiffResult } from "./compareCaptures.js";

/** Machine-readable render metadata, shared by MCP, CLI and the editor without PNG byte arrays. */
export function renderEvidence({ png: _png, ...evidence }: RenderResult) { return { schemaVersion: 1 as const, ...evidence }; }

/** Machine-readable comparison metadata; image files travel separately from the token-cheap evidence. */
export function diffEvidence({ before, after, diffPng: _png, ...evidence }: DiffResult) {
  return { schemaVersion: 1 as const, errors: after.errors, ...evidence, before: renderEvidence(before), after: renderEvidence(after) };
}

/** Compact batch metadata omits buffers and avoids duplicating a comparison's after evidence. */
export function matrixEvidence(report: import("./renderMatrix.js").MatrixReport) {
  return { schemaVersion: 1 as const, ...report, cells: report.cells.map(({ render, diff, ...cell }) => ({ ...cell,
    ...(diff ? { diff: diffEvidence(diff) } : render ? { render: renderEvidence(render) } : {}),
  })) };
}
