import path from "node:path";
import { z } from "zod";
import type { RenderRequest, RenderResult } from "./createRenderer.js";
import { conditionsSchema, actionsSchema } from "./renderChecks.js";
import { packageVersion } from "../packageVersion.js";

const object = z.record(z.string(), z.unknown());
const size = z.object({ width: z.number().int().min(1).max(8192), height: z.number().int().min(1).max(8192) }).strict();
/** Versioned data is validated before a saved check can execute project code. */
export const recipeSchema = z.object({
  version: z.literal(1),
  target: z.object({ file: z.string().min(1).max(4096), exportName: z.string().optional(), props: object,
    engine: z.string().optional(), profile: z.string().optional(), templateResolved: z.boolean().optional(), usage: z.string().optional(), inContext: z.boolean().optional(),
    frame: size.extend({ background: z.string().optional(), padding: z.number().nonnegative().optional() }).optional(), theme: z.enum(["light", "dark"]).optional(),
    actions: actionsSchema.optional(), ready: conditionsSchema.optional(), expectations: conditionsSchema.optional(),
    storage: z.object({ local: z.record(z.string(), z.string()).optional(), session: z.record(z.string(), z.string()).optional() }).strict().optional(),
    fixtures: object.optional(), inspection: object.optional(), capturePolicy: object.optional(),
  }).strict(),
  viewport: size,
  provenance: z.object({ propsSource: z.enum(["given", "usage", "sample", "none"]), unresolved: z.array(z.string()), inputWarnings: z.array(z.string()), sourceRevision: z.string(), toolVersion: z.string() }).strict(),
  omittedInputs: z.array(z.enum(["storage", "fixtures.network"])).max(2),
}).strict();
/** Portable regression inputs; source fingerprints describe the original run, not approval of future output. */
export type RenderRecipe = z.infer<typeof recipeSchema>;

/** Saves resolved inputs without silently exporting browser storage or request-response bodies. */
export function createRenderRecipe(root: string, result: RenderResult, includeBrowserInputs = false): RenderRecipe {
  const target = structuredClone(result.target);
  target.file = relativeFile(root, target.file);
  if (!target.inContext) delete target.usage;
  const omittedInputs: RenderRecipe["omittedInputs"] = [];
  if (includeBrowserInputs !== true && target.storage) { delete target.storage; omittedInputs.push("storage"); }
  if (includeBrowserInputs !== true && target.fixtures?.network) { delete target.fixtures.network; omittedInputs.push("fixtures.network"); }
  const recipe = { version: 1, target, viewport: result.viewport, provenance: { propsSource: result.propsSource, unresolved: result.unresolved, inputWarnings: result.warnings.filter((w) => w.startsWith("Runtime usage inputs were not evaluated:") || w.startsWith("Sample props were generated from types;")), sourceRevision: result.sourceRevision, toolVersion: packageVersion }, omittedInputs };
  return readRenderRecipe(root, recipe, true).recipe;
}

/** Resolves a recipe inside the selected project; omitted inputs require explicit repair before replay. */
export function readRenderRecipe(root: string, value: unknown, allowOmitted = false): { recipe: RenderRecipe; request: RenderRequest } {
  if (Buffer.byteLength(JSON.stringify(value) ?? "") > 1_048_576) throw new Error("Invalid recipe: JSON exceeds 1 MiB");
  const parsed = recipeSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid recipe (supported version: 1): ${parsed.error.message}`);
  const recipe = parsed.data;
  const file = path.resolve(root, recipe.target.file);
  relativeFile(root, file);
  if (path.isAbsolute(recipe.target.file) || /^[A-Za-z]:/.test(recipe.target.file)) throw new Error("Recipe file must be relative to the project");
  if (!allowOmitted && recipe.omittedInputs.length) throw new Error(`Recipe omitted ${recipe.omittedInputs.join(", ")}; restore explicit inputs and clear omittedInputs, or export with includeBrowserInputs after reviewing the contents.`);
  return { recipe, request: { ...recipe.target, file, viewport: recipe.viewport } as RenderRequest };
}

function relativeFile(root: string, file: string): string {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error(`Recipe target is outside the project: ${file}`);
  return relative.split(path.sep).join("/");
}
