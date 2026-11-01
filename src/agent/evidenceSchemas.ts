import { z } from "zod";

const common = { schemaVersion: z.literal(1), errors: z.array(z.string()) };
const record = z.record(z.string(), z.unknown());
const viewport = z.object({ width: z.number(), height: z.number() });
const region = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });

/** Reports project prerequisites even when rendering cannot start. */
export const projectOutputSchema = z.object({
  ...common, root: z.string(), packages: z.array(z.object({ name: z.string(), installed: z.string().nullable(), declared: z.string().nullable(), root: z.string().nullable() })),
  diagnostics: z.array(z.object({ code: z.string(), severity: z.enum(["error", "warning", "info"]), message: z.string(), recovery: z.string() })),
  build: z.object({ mode: z.literal("native"), executesVitePlugins: z.literal(false) }).passthrough(),
  browser: z.object({ probed: z.literal(false), note: z.string() }),
}).passthrough();

/** Request failures have errors but no invented render/prop data; SDK clients validate errors against this schema too. */
export const toolOutputSchema = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.partial().extend(common).passthrough()
    .describe("schemaVersion and errors are always present. Tool-specific evidence is absent when the request fails before producing it; inspect isError and errors first.");

/** Declares render evidence independently of optional image/text presentation. */
export const renderOutputSchema = z.object({
  ...common, captureId: z.string().optional(),
  target: z.object({ file: z.string(), exportName: z.string(), props: record }).passthrough(),
  viewport, sourceRevision: z.string(), unresolved: z.array(z.string()), warnings: z.array(z.string()),
  complete: z.boolean(), snapshot: z.string(), ms: z.number(), reloaded: z.boolean(),
  propsSource: z.enum(["given", "usage", "sample", "none"]),
}).passthrough();

/** Declares immutable before/after evidence without embedding PNG bytes. */
export const diffOutputSchema = z.object({
  ...common, status: z.enum(["unchanged", "changed", "incomplete"]), before: renderOutputSchema, after: renderOutputSchema,
  changedPixels: z.number(), changedPercent: z.number(), changedRegion: region.nullable(), snapshotChanged: z.boolean(),
  dimensions: z.object({ before: viewport, after: viewport }), newErrors: z.array(z.string()), resolvedErrors: z.array(z.string()), newWarnings: z.array(z.string()), resolvedWarnings: z.array(z.string()),
}).passthrough();

/** Gives static prop inspection a machine-readable counterpart to its existing text. */
export const propsOutputSchema = z.object({ ...common, props: z.array(z.object({ name: z.string(), kind: z.string(), required: z.boolean() }).passthrough()), sample: record });

/** Preserves usage handles and unresolved inputs for clients consuming structured results. */
export const usagesOutputSchema = z.object({ ...common, usages: z.array(z.object({ id: z.string(), props: record, unresolved: z.array(z.string()) }).passthrough()) });

/** Keeps batch evidence bounded and pagination explicit across MCP clients. */
export const usageRendersOutputSchema = z.object({ ...common, results: z.array(renderOutputSchema.extend({ usage: z.string() })), total: z.number(), nextCursor: z.string().nullable(), coverage: z.string() });

/** Makes whole-project mount coverage distinct from visual fidelity. */
export const auditOutputSchema = z.object({
  ...common, root: z.string(), total: z.number(), ok: z.number(), error: z.number(), empty: z.number(), skipped: z.number(),
  entries: z.array(z.object({ file: z.string(), status: z.enum(["ok", "error", "empty", "skipped"]) }).passthrough()),
  topErrors: z.array(z.object({ message: z.string(), count: z.number() })),
});
