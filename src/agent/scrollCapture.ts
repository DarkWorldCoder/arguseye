import type { Page } from "playwright-core";

/** Opt-in traversal activates real observers; it never rewrites application visibility. */
export type ScrollPolicy = { selector?: string; maxSteps?: number; timeoutMs?: number; maxDistance?: number };
/** Traversal coverage is separate from whether every reveal or asset actually finished. */
export type ScrollEvidence = { selector?: string; visited: Array<{ x: number; y: number }>; complete: boolean; restored: boolean; ms: number; reason?: string };

/** Rejects excessive traversal work before mounting or scrolling project code. */
export function validateScrollPolicy(policy: ScrollPolicy): void {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) throw new Error("Scroll policy must be a JSON object.");
  for (const [key, value, max] of [["maxSteps", policy.maxSteps, 64], ["timeoutMs", policy.timeoutMs, 10000], ["maxDistance", policy.maxDistance, 100000]] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > max)) throw new Error(`Invalid scroll ${key} "${value}"; use an integer from 1 to ${max}.`);
  }
  if (policy.selector !== undefined && (typeof policy.selector !== "string" || !policy.selector.trim() || policy.selector.length > 1024)) throw new Error("Scroll selector must contain 1–1024 characters.");
}

/** Visits a bounded vertical scroll range and restores the requested final view before capture. */
export async function scrollCapture(page: Page, policy: ScrollPolicy, guard: () => void): Promise<ScrollEvidence> {
  const started = performance.now(), maxSteps = policy.maxSteps ?? 20, timeout = policy.timeoutMs ?? 2000, distance = policy.maxDistance ?? 20000;
  const measure = () => page.evaluate((selector) => {
    const matches = selector ? document.querySelectorAll(selector) : null;
    if (matches && matches.length !== 1) throw new Error(`Scroll container "${selector}" matched ${matches.length} elements; choose exactly one.`);
    const node = matches ? matches[0] : document.scrollingElement;
    if (!(node instanceof HTMLElement)) throw new Error(`Scroll container "${selector ?? "document"}" is not an HTML scroll container.`);
    return { x: node.scrollLeft, y: node.scrollTop, height: node.scrollHeight, viewport: node.clientHeight };
  }, policy.selector);
  const original = await measure();
  const move = (x: number, y: number) => page.evaluate(({ selector, x, y }) => {
    const node = selector ? document.querySelector(selector) : document.scrollingElement;
    if (!(node instanceof HTMLElement)) throw new Error(`Scroll container "${selector ?? "document"}" disappeared.`);
    node.scrollTo({ left: x, top: y, behavior: "instant" });
  }, { selector: policy.selector, x, y });
  const result: ScrollEvidence = { ...(policy.selector ? { selector: policy.selector } : {}), visited: [], complete: false, restored: false, ms: 0 };
  try {
    let next = 0;
    for (let step = 0; step < maxSteps; step++) {
      guard();
      if (performance.now() - started >= timeout) { result.reason = "time budget reached"; break; }
      await move(original.x, next);
      // Browser observers and lazy resources need real opportunities to run, without synthetic app timers.
      await page.waitForTimeout(Math.min(40, Math.max(1, timeout - (performance.now() - started))));
      guard();
      const current = await measure();
      result.visited.push({ x: current.x, y: current.y });
      if (current.viewport <= 0) { result.reason = "container has no visible height"; break; }
      if (current.y + current.viewport >= current.height - 1) { result.complete = true; break; }
      const advance = Math.max(1, Math.floor(current.viewport * 0.8));
      next = Math.min(current.height - current.viewport, current.y + advance, distance);
      if (next <= current.y) { result.reason = "distance budget reached or scrolling did not advance"; break; }
      if (step > 0 && current.y <= result.visited[step - 1].y) { result.reason = "scroll position did not advance"; break; }
    }
    if (!result.complete && !result.reason) result.reason = "step budget reached";
  } finally {
    try {
      await move(original.x, original.y);
      await page.waitForTimeout(40);
      const restored = await measure();
      result.restored = Math.abs(restored.x - original.x) < 1 && Math.abs(restored.y - original.y) < 1;
    } catch { result.restored = false; }
    result.ms = Math.round(performance.now() - started);
  }
  if (!result.restored) { result.complete = false; result.reason = "original scroll position could not be restored"; }
  return result;
}
