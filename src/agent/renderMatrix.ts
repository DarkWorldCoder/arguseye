import { z } from "zod";
import { recipeSchema } from "./renderRecipe.js";
import { actionsSchema, conditionsSchema } from "./renderChecks.js";
import type { RenderRequest, RenderResult } from "./createRenderer.js";
import type { DiffResult } from "./compareCaptures.js";

/** Explicit cases avoid accidentally expanding every prop/theme/viewport combination. */
export const matrixCasesSchema = z.array(z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  viewport: z.object({ width: z.number().int().min(1).max(4096), height: z.number().int().min(1).max(4096) }).strict(),
  theme: z.enum(["light", "dark"]),
  props: z.record(z.string(), z.unknown()).optional(),
  actions: actionsSchema.optional(), ready: conditionsSchema.optional(), expectations: conditionsSchema.optional(),
}).strict()).min(1).max(12).refine((cases) => new Set(cases.map((cell) => cell.id)).size === cases.length, "Matrix case IDs must be unique");
/** Matrix manifests share the saved-check target contract, including project-owned context. */
export const matrixRequestSchema = z.object({ target: recipeSchema.shape.target.extend({ props: z.record(z.string(), z.unknown()).optional() }), cases: matrixCasesSchema }).strict();
/** Saved capture IDs are paired with case IDs verbatim; inputs always come from the baseline. */
export const matrixBaselinesSchema = z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), captureId: z.string().min(1).optional() }).strict()).min(1).max(12).refine((cases) => new Set(cases.map((cell) => cell.id)).size === cases.length, "Matrix case IDs must be unique");
/** A single named context; props/actions/check arrays replace their target defaults when supplied. */
export type MatrixCase = z.infer<typeof matrixCasesSchema>[number];
/** Shared request for isolated verification across explicitly selected contexts. */
export type MatrixRequest = { target: RenderRequest; cases: MatrixCase[] };
/** Every requested case remains visible even when it could not be run or compared. */
export type MatrixCell = { id: string; status: "passed" | "failed" | "incomplete" | "changed" | "unchanged" | "not-run" | "not-compared"; errors: string[]; render?: RenderResult; diff?: DiffResult };
/** A batch's coverage and evidence; visual changes require review rather than implying failure. */
export type MatrixReport = {
  status: "passed" | "changed" | "failed" | "incomplete"; complete: boolean; ms: number;
  sourceConsistent: boolean; warnings: string[]; errors: string[]; cells: MatrixCell[];
  coverage: { requested: number; executed: number; compared: number; passed: number; changed: number; unchanged: number; failed: number; incomplete: number; notRun: number; notCompared: number };
};
/** Groups evidence without mistaking failed behavioral expectations for render exceptions. */
export function matrixCell(id: string, render: RenderResult, diff?: DiffResult): MatrixCell {
  const failed = render.errors.length || [...(render.readiness ?? []), ...(render.expectations ?? [])].some((check) => check.status === "failed");
  return { id, status: failed ? "failed" : !render.complete || diff?.status === "incomplete" ? "incomplete" : diff?.status ?? "passed", errors: [...render.errors], render, ...(diff ? { diff } : {}) };
}
/** Holds only this batch's results, preserving completed cases when the outer job is interrupted. */
export function createMatrixRun(ids: string[]) {
  const start = performance.now();
  const cells: MatrixCell[] = ids.map((id) => ({ id, status: "not-run", errors: [] }));
  let finished = false;
  return {
    record(index: number, cell: MatrixCell) { if (!finished) cells[index] = cell; },
    finish(sourceConsistent: boolean, error?: Error): MatrixReport {
      finished = true;
      const coverage = { requested: ids.length, executed: cells.filter((cell) => !!cell.render || cell.status === "failed").length, compared: cells.filter((cell) => !!cell.diff).length, passed: 0, changed: 0, unchanged: 0, failed: 0, incomplete: 0, notRun: 0, notCompared: 0 };
      for (const cell of cells) {
        if (cell.status === "not-run") coverage.notRun++;
        else if (cell.status === "not-compared") coverage.notCompared++;
        else coverage[cell.status]++;
      }
      const complete = sourceConsistent && !error && !cells.some((cell) => cell.render ? !cell.render.complete : cell.status === "failed") && !coverage.incomplete && !coverage.notRun && !coverage.notCompared;
      return { cells: [...cells], coverage, complete, sourceConsistent, ms: performance.now() - start,
        status: !complete ? "incomplete" : coverage.failed ? "failed" : coverage.changed ? "changed" : "passed",
        warnings: sourceConsistent ? [] : ["Source changed during the matrix. These cases do not verify one source revision; rerun after edits stop."],
        errors: [...(error ? [error.message] : []), ...cells.flatMap((cell) => cell.errors)] };
    },
  };
}
