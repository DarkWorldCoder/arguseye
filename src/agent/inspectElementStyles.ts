import type { CDPSession, Page } from "playwright-core";

/** Observed font glyph usage comes from Chromium, not the requested CSS family alone. */
export type FontEvidence = { requested: string; weight: string; size: string; status: "available" | "unavailable"; used: Array<{ familyName: string; isCustomFont: boolean; glyphCount: number }>; reason?: string };
/** Geometry observations describe the captured state; clipping and ellipsis can be intentional. */
export type ElementStyleEvidence = { selector: string; tag: string; text: string; bounds?: { x: number; y: number; width: number; height: number }; observations?: string[]; styles?: Record<string, string>; font?: FontEvidence };

/** Bounded opt-in geometry and glyph-font inspection; ordinary renders do not enable DOM/CSS agents. */
export async function inspectElementStyles(page: Page, scope: string, request: { layout?: boolean; fonts?: boolean; selector?: string }) {
  const started = performance.now();
  const raw = await page.evaluate(({ scope, layout, fonts, selector }) => {
    const container = document.querySelector(scope);
    const nodes = [...document.querySelectorAll(selector ?? scope + " *")].filter((element) => container?.contains(element));
    const elements = nodes.slice(0, 100).map((element) => {
      const chain: string[] = []; let node: Element | null = element;
      while (node && node.id !== "root" && node !== document.body) {
        const index = node.parentElement ? [...node.parentElement.children].indexOf(node) + 1 : 1;
        chain.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`); node = node.parentElement;
      }
      const selector = node?.id === "root" ? "#root" + (chain.length ? " > " + chain.join(" > ") : "") : "body" + (chain.length ? " > " + chain.join(" > ") : "");
      const rect = element.getBoundingClientRect(), css = getComputedStyle(element);
      const observations: string[] = [];
      if (layout) {
        if (!rect.width || !rect.height) observations.push("zero-size");
        if (element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1) observations.push("horizontal-overflow");
        if (element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1) observations.push("vertical-overflow");
        if (css.textOverflow === "ellipsis" && element.scrollWidth > element.clientWidth + 1) observations.push("text-ellipsis");
        for (let parent: Element | null = element, depth = 0; parent && depth < 40; parent = parent.parentElement, depth++) {
          const style = getComputedStyle(parent);
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) observations.push(parent === element ? "hidden" : "hidden-by-ancestor");
          if (parent === element) continue;
          const box = parent.getBoundingClientRect();
          if ((/^(hidden|clip|auto|scroll)$/.test(style.overflowX) && (rect.left < box.left - 1 || rect.right > box.right + 1)) || (/^(hidden|clip|auto|scroll)$/.test(style.overflowY) && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1))) observations.push("clipped-by-ancestor");
        }
      }
      return { selector, tag: element.tagName.toLowerCase(), text: (element.textContent ?? "").trim().slice(0, 160),
        ...(layout ? { bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, observations: [...new Set(observations)], styles: { display: css.display, visibility: css.visibility, opacity: css.opacity, overflowX: css.overflowX, overflowY: css.overflowY, color: css.color, backgroundColor: css.backgroundColor, lineHeight: css.lineHeight } } : {}),
        ...(fonts ? { font: { requested: css.fontFamily, weight: css.fontWeight, size: css.fontSize, status: "unavailable" as const, used: [] } } : {}),
      };
    });
    return { elements, total: nodes.length };
  }, { scope, layout: !!request.layout, fonts: !!request.fonts, selector: request.selector });
  const elements: ElementStyleEvidence[] = raw.elements;
  let reason = request.selector && !raw.total ? `No elements matched "${request.selector}" within ${scope}.` : undefined;
  if (request.fonts && elements.length) {
    let session: CDPSession | undefined;
    try {
      session = await page.context().newCDPSession(page);
      await session.send("DOM.enable"); await session.send("CSS.enable");
      const { root } = await session.send("DOM.getDocument", { depth: 0 });
      for (const element of elements) {
        if (!element.font) continue;
        try {
          const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: element.selector });
          if (!nodeId) throw new Error("Element changed or is not addressable in this document.");
          const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
          element.font.used = fonts.map(({ familyName, isCustomFont, glyphCount }) => ({ familyName, isCustomFont, glyphCount }));
          element.font.status = "available";
        } catch (error) { element.font.reason = String((error as Error).message ?? error); }
      }
    } catch (error) {
      reason = "Font inspection unavailable: " + String((error as Error).message ?? error);
      for (const element of elements) if (element.font?.status === "unavailable") element.font.reason ??= reason;
    } finally { await session?.detach().catch(() => {}); }
    if (elements.some((element) => element.font?.status === "unavailable")) reason ??= "Font inspection unavailable for some elements; inspect their font.reason fields.";
  }
  return { elements, styleInspection: { scope, ...(request.selector ? { selector: request.selector } : {}), total: raw.total, inspected: elements.length, limit: 100, complete: !reason && raw.total <= 100 && elements.every((element) => element.font?.status !== "unavailable"), ...(reason ? { reason } : {}), ms: Math.round(performance.now() - started), note: "Observed DOM geometry and used fonts only; observations are not correctness verdicts. Closed/open shadow trees and iframe documents are outside this selector-based inspection. A used font can differ legitimately from the first CSS family." } };
}
