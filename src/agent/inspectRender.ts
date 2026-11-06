import { fileFromUrl } from "../server/fileUrl.js";
import type { Page } from "playwright-core";
import type { PreviewServer } from "../server/createPreviewServer.js";
import { inspectElementStyles, type ElementStyleEvidence } from "./inspectElementStyles.js";

export type SourcePoint = { file: string; line: number; column: number };
export type ErrorLocation = { generated: SourcePoint; original: SourcePoint | null; reason?: string };
export type ElementEvidence = ElementStyleEvidence & { component?: string; source?: Partial<SourcePoint> & { file: string; kind: "mapped" | "component-file" }; reason?: string };
export type AccessibilityEvidence = { engine: string; scope: string; ms: number; violations: AccessibilityFinding[]; incomplete: AccessibilityFinding[]; passes: number; inapplicable: number; note: string };
type AccessibilityFinding = { id: string; impact: string | null; description: string; help: string; helpUrl: string; nodes: Array<{ target: unknown; html: string; summary?: string }> };

/** Selector-focused DOM evidence stays inside the captured scope; axe retains its full component scope. */
export type InspectionRequest = { accessibility?: boolean; sources?: boolean; layout?: boolean; fonts?: boolean; selector?: string };

/** Parses actual preview-module stack positions; package/chunk frames without maps remain generated evidence. */
export async function errorLocations(errors: string[], server: PreviewServer): Promise<ErrorLocation[]> {
  const points: SourcePoint[] = [], seen = new Set<string>();
  for (const error of errors.slice(0, 10)) for (const match of error.matchAll(/\/@fs([^\s)]+?):(\d+):(\d+)/g)) {
    let file: string;
    try { file = fileFromUrl(match[1].split("?")[0]); } catch { continue; }
    const point = { file, line: Number(match[2]), column: Number(match[3]) };
    const key = JSON.stringify(point); if (!seen.has(key)) { seen.add(key); points.push(point); }
    if (points.length >= 40) break;
  }
  return Promise.all(points.slice(0, 40).map(async (generated) => {
    const original = await server.sourceLocation?.(generated.file, generated.line, generated.column).catch(() => null) ?? null;
    return { generated, original, ...(original ? {} : { reason: "No trustworthy original-source map is available for this compiler chain." }) };
  }));
}

/** Runs heavy inspection only when requested; automated findings never establish accessibility conformance. */
export async function inspectRender(page: Page, server: PreviewServer, request: InspectionRequest, scope: string) {
  if (request.selector !== undefined) {
    if (typeof request.selector !== "string" || !request.selector.trim() || request.selector.length > 2000) throw new Error("Inspection selector must contain 1–2000 characters.");
    request = { ...request, layout: true };
  }
  let accessibility: AccessibilityEvidence | undefined;
  let elements: ElementEvidence[] | undefined;
  if (request.sources) {
    const raw = await page.evaluate(({ scope, selector }) => [...document.querySelectorAll(selector ?? scope + " *")].filter((element) => document.querySelector(scope)?.contains(element)).slice(0, 100).map((element) => {
      const el = element as any, cp = (window as any).__CP__;
      let fiber = el[Object.keys(el).find((key) => key.startsWith("__reactFiber$")) ?? ""];
      let component: string | undefined, componentFile: string | undefined, stack = "";
      for (let i = 0; fiber && i < 40; i++, fiber = fiber.return) {
        component ??= typeof fiber.type === "function" ? fiber.type.displayName ?? fiber.type.name : undefined;
        if (fiber.type === cp.component) componentFile = cp.target.file;
        stack ||= fiber._debugStack?.stack ?? fiber._debugOwner?._debugStack?.stack ?? "";
      }
      const vue = el.__vueParentComponent;
      if (vue?.type?.__file) { componentFile = vue.type.__file; component = vue.type.__name ?? vue.type.name; }
      const chain = []; let node: Element | null = element;
      while (node && node.id !== "root" && node !== document.body) {
        const index = node.parentElement ? [...node.parentElement.children].indexOf(node) + 1 : 1;
        chain.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`); node = node.parentElement;
      }
      return { selector: node?.id === "root" ? "#root" + (chain.length ? " > " + chain.join(" > ") : "") : "body" + (chain.length ? " > " + chain.join(" > ") : ""), tag: element.tagName.toLowerCase(), text: (element.textContent ?? "").trim().slice(0, 160), component, componentFile, stack };
    }), { scope, selector: request.selector });
    elements = await Promise.all(raw.map(async ({ componentFile, stack, ...element }): Promise<ElementEvidence> => {
      const mapped = (await errorLocations([stack], server)).find((ref) => ref.original)?.original;
      if (mapped) return { ...element, source: { ...mapped, kind: "mapped" } };
      if (componentFile) { try { server.assertAccess(componentFile); return { ...element, source: { file: componentFile, kind: "component-file" }, reason: "Owning component file only; this is not an exact DOM-to-source line." }; } catch {} }
      return { ...element, reason: "This runtime exposes no trustworthy component source reference for this element." };
    }));
  }
  if (request.accessibility) {
    const started = performance.now();
    const { default: axe } = await import("axe-core");
    await page.evaluate(axe.source);
    const findings = await page.evaluate(async (scope) => {
      const axe = (window as any).axe;
      const report = await axe.run(scope, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations", "incomplete", "passes", "inapplicable"] });
      const compact = (entries: any[]) => entries.map((r) => ({ id: r.id, impact: r.impact ?? null, description: r.description, help: r.help, helpUrl: r.helpUrl, nodes: r.nodes.slice(0, 20).map((n: any) => ({ target: n.target, html: n.html.slice(0, 500), summary: n.failureSummary })) }));
      return { engine: "axe-core " + axe.version, scope, violations: compact(report.violations), incomplete: compact(report.incomplete), passes: report.passes.length, inapplicable: report.inapplicable.length };
    }, scope);
    accessibility = { ...findings, ms: Math.round(performance.now() - started), note: "Automated component-scope checks only. Incomplete checks need human review; absence of violations is not accessibility conformance." };
  }
  let styleInspection: Awaited<ReturnType<typeof inspectElementStyles>>["styleInspection"] | undefined;
  if (request.layout || request.fonts) {
    const inspected = await inspectElementStyles(page, scope, request);
    styleInspection = inspected.styleInspection;
    const sources = new Map(elements?.map((element) => [element.selector, element]));
    elements = inspected.elements.map((element) => ({ ...sources.get(element.selector), ...element }));
  }
  return { ...(accessibility ? { accessibility } : {}), ...(elements ? { elements } : {}), ...(styleInspection ? { styleInspection } : {}) };
}
