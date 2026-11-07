import type { Locator, Page } from "playwright-core";
import { z } from "zod";
import type { Target } from "./createRenderer.js";

const text = z.string().min(1).max(2000);
/** The same strict locator vocabulary is used for actions, readiness and expectations. */
export const targetSchema = z.object({ role: text.optional(), name: text.optional(), text: text.optional(), label: text.optional(), placeholder: text.optional(), testId: text.optional(), selector: text.optional(), exact: z.boolean().optional(), scope: z.enum(["root", "capture"]).optional() }).strict().refine((t) => !!(t.role || t.name || t.text || t.label || t.placeholder || t.testId || t.selector), "A target needs a role, text, label, placeholder, testId or selector");
/** Explicit conditions contain data only; they never evaluate caller-supplied JavaScript. */
export const conditionSchema = z.object({
  target: targetSchema,
  state: z.enum(["visible", "hidden", "attached", "detached", "text", "count", "checked", "expanded", "focused"]),
  value: z.union([z.string().max(2000), z.number().int().nonnegative(), z.boolean()]).optional(),
  timeoutMs: z.number().int().min(1).max(5000).optional(),
}).strict().superRefine((c, ctx) => {
  const kind = c.state === "text" ? "string" : c.state === "count" ? "number" : ["checked", "expanded"].includes(c.state) ? "boolean" : undefined;
  if (kind && typeof c.value !== kind || !kind && c.value !== undefined) ctx.addIssue({ code: "custom", path: ["value"], message: `${c.state} ${kind ? "requires a " + kind + " value" : "does not accept value"}` });
});
/** Bounds requested checks independently of the whole render deadline. */
export const conditionsSchema = z.array(conditionSchema).max(20);
const verbs = ["click", "dblclick", "hover", "fill", "type", "check", "uncheck", "select", "focus", "press", "wait", "scroll"];
/** A bounded action list rejects malformed or multi-verb steps before mounting project code. */
export const actionsSchema = z.array(z.object({
  click: targetSchema.optional(), dblclick: targetSchema.optional(), hover: targetSchema.optional(), fill: targetSchema.optional(), type: targetSchema.optional(), check: targetSchema.optional(), uncheck: targetSchema.optional(), select: targetSchema.optional(), focus: targetSchema.optional(),
  press: z.string().min(1).max(200).optional(), wait: z.number().finite().min(0).max(5000).optional(), scroll: z.object({ x: z.number().finite().optional(), y: z.number().finite().optional() }).strict().optional(), value: z.string().max(20000).optional(),
}).strict().refine((a) => verbs.filter((v) => a[v as keyof typeof a] !== undefined).length === 1, "Each action needs exactly one verb")).max(50);
/** CLI and editor check documents share the renderer's typed conditions and action bounds. */
export const verificationInputsSchema = z.object({ ready: conditionsSchema.optional(), expectations: conditionsSchema.optional(), actions: actionsSchema.optional() }).strict();
/** A caller-authored condition, replayed verbatim with a baseline. */
export type RenderCondition = z.infer<typeof conditionSchema>;
/** Expectations are distinct from render errors and evidence completeness. */
export type CheckEvidence = { condition: RenderCondition; status: "passed" | "failed" | "not-run"; ms: number; observed?: { count: number; text?: string; visible?: boolean; checked?: boolean | "mixed"; expanded?: boolean; focused?: boolean }; message?: string };

/** Resolves without first-match shortcuts; body scope is explicit for captured portals. */
export function locateTarget(page: Page, t: Target): Locator {
  if (t.scope !== undefined && t.scope !== "root" && t.scope !== "capture") throw new Error(`Unknown target scope "${t.scope}"`);
  const root = page.locator(t.scope === "capture" ? "body" : "#root");
  if (t.selector) return root.locator(t.selector);
  if (t.testId) return root.getByTestId(t.testId);
  if (t.label) return root.getByLabel(t.label, { exact: t.exact });
  if (t.placeholder) return root.getByPlaceholder(t.placeholder, { exact: t.exact });
  if (t.role) return root.getByRole(t.role as any, { name: t.name, exact: t.exact });
  if (t.text || t.name) return root.getByText(t.text ?? t.name!, { exact: t.exact });
  throw new Error("target needs role, text, label, placeholder, testId or selector");
}

/** Rejects malformed conditions before mounting the user's component. */
export function validateChecks(name: string, conditions: RenderCondition[] | undefined): void {
  if (conditions === undefined) return;
  const result = conditionsSchema.safeParse(conditions);
  if (!result.success) throw new Error(`Invalid ${name} checks: ${result.error.message}`);
}

/** Polls observations under per-condition and render deadlines without adding work to plain renders. */
export async function runChecks(page: Page, conditions: RenderCondition[], guard: () => void, skip?: string): Promise<CheckEvidence[]> {
  const results: CheckEvidence[] = [];
  for (const condition of conditions) {
    guard();
    if (skip) { results.push({ condition, status: "not-run", ms: 0, message: skip }); continue; }
    const start = performance.now(), timeout = condition.timeoutMs ?? 2000;
    let observed: CheckEvidence["observed"], message: string | undefined;
    try {
      const locator = locateTarget(page, condition.target);
      do {
        guard();
        observed = await locator.evaluateAll((nodes) => {
          const el = nodes[0];
          if (!el) return { count: 0 };
          const box = el.getBoundingClientRect(), style = getComputedStyle(el), checked = el.getAttribute("aria-checked"), expanded = el.getAttribute("aria-expanded");
          return { count: nodes.length, text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 2001), visible: box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.visibility !== "collapse", checked: (el as HTMLInputElement).indeterminate === true || checked === "mixed" ? "mixed" as const : typeof (el as HTMLInputElement).checked === "boolean" ? (el as HTMLInputElement).checked : checked === "true" ? true : checked === "false" ? false : undefined, expanded: expanded === "true" ? true : expanded === "false" ? false : undefined, focused: (el.getRootNode() as Document | ShadowRoot).activeElement === el };
        });
        if (condition.state !== "count" && observed.count > 1) { message = `Ambiguous target matched ${observed.count} elements; refine its name, selector or testId.`; break; }
        const passed = condition.state === "count" ? observed.count === condition.value
          : condition.state === "attached" ? observed.count === 1
          : condition.state === "detached" ? observed.count === 0
          : condition.state === "visible" ? observed.visible === true
          : condition.state === "hidden" ? observed.count === 0 || observed.visible === false
          : condition.state === "text" ? observed.count === 1 && observed.text === condition.value
          : condition.state === "focused" ? observed.focused === true
          : observed[condition.state] === condition.value;
        if (passed) { results.push({ condition, status: "passed", ms: Math.round(performance.now() - start), observed }); break; }
        const left = timeout - (performance.now() - start);
        if (left <= 0) { message = `Expected ${condition.state}${condition.value !== undefined ? " " + JSON.stringify(condition.value) : ""} within ${timeout} ms.`; break; }
        await new Promise((resolve) => setTimeout(resolve, Math.min(20, left)));
      } while (true);
    } catch (error) { guard(); message = String((error as Error).message ?? error).split("\n")[0]; }
    guard();
    if (message) results.push({ condition, status: "failed", ms: Math.round(performance.now() - start), observed, message });
  }
  return results;
}
