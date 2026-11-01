import type { Page } from "playwright-core";
import type { RenderResult } from "./createRenderer.js";

/** Evidence of visual and semantic changes; a changed frame is not a correctness verdict. */
export type DiffResult = {
  status: "unchanged" | "changed" | "incomplete";
  before: RenderResult;
  after: RenderResult;
  diffPng: Buffer;
  changedPixels: number;
  changedPercent: number;
  /** Bounding box of the changed pixels in the after image, or null when nothing changed. */
  changedRegion: { x: number; y: number; width: number; height: number } | null;
  dimensions: { before: { width: number; height: number }; after: { width: number; height: number } };
  snapshotChanged: boolean;
  newErrors: string[];
  resolvedErrors: string[];
  newWarnings: string[];
  resolvedWarnings: string[];
};

/** Compares decoded pixels in Chromium, avoiding a second image codec and work on ordinary renders. */
export async function compareCaptures(page: Page, before: RenderResult, after: RenderResult): Promise<DiffResult> {
  const pixels = await page.evaluate(async ([a, b]) => {
    const decode = (data: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = reject;
      img.src = "data:image/png;base64," + data;
    });
    const [aImg, bImg] = await Promise.all([decode(a), decode(b)]);
    const width = Math.max(aImg.width, bImg.width), height = Math.max(aImg.height, bImg.height);
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(aImg, 0, 0); const old = ctx.getImageData(0, 0, width, height);
    ctx.clearRect(0, 0, width, height); ctx.drawImage(bImg, 0, 0); const next = ctx.getImageData(0, 0, width, height);
    // Perceptual distance in YIQ space (as pixelmatch): antialiasing and subpixel noise below the threshold is not a change.
    const MAX = 35215, THRESHOLD = 0.1 * 0.1 * MAX;
    const blend = (c: number, a: number) => 255 + (c - 255) * (a / 255);
    const delta = (d: Uint8ClampedArray, e: Uint8ClampedArray, i: number) => {
      const r1 = blend(d[i], d[i + 3]), g1 = blend(d[i + 1], d[i + 3]), b1 = blend(d[i + 2], d[i + 3]);
      const r2 = blend(e[i], e[i + 3]), g2 = blend(e[i + 1], e[i + 3]), b2 = blend(e[i + 2], e[i + 3]);
      const y = (r1 - r2) * 0.29889531 + (g1 - g2) * 0.58662247 + (b1 - b2) * 0.11448223;
      const iq = (r1 - r2) * 0.59597799 - (g1 - g2) * 0.2741761 - (b1 - b2) * 0.32180189;
      const q = (r1 - r2) * 0.21147017 - (g1 - g2) * 0.52261711 + (b1 - b2) * 0.31114694;
      return 0.5053 * y * y + 0.299 * iq * iq + 0.1957 * q * q;
    };
    let changedPixels = 0, minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    for (let i = 0; i < old.data.length; i += 4) {
      const x = (i / 4) % width, y = Math.floor(i / 4 / width);
      const different = (x < aImg.width && y < aImg.height) !== (x < bImg.width && y < bImg.height) || delta(old.data, next.data, i) > THRESHOLD;
      if (different) {
        changedPixels++; next.data.set([230, 30, 110, 255], i);
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      } else { const gray = Math.round((next.data[i] + next.data[i + 1] + next.data[i + 2]) / 3); next.data.set([gray, gray, gray, 100], i); }
    }
    ctx.putImageData(next, 0, 0);
    return {
      changedPixels, changedPercent: changedPixels / (width * height) * 100,
      changedRegion: changedPixels ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
      png: canvas.toDataURL("image/png").split(",")[1], dimensions: { before: { width: aImg.width, height: aImg.height }, after: { width: bImg.width, height: bImg.height } },
    };
  }, [before.png.toString("base64"), after.png.toString("base64")]);
  const { png, ...metrics } = pixels;
  const snapshotChanged = before.snapshot !== after.snapshot;
  const timerVariance = (pixels.changedPixels > 0 || snapshotChanged) && (before.scheduledTimers || after.scheduledTimers) && before.sourceRevision === after.sourceRevision && JSON.stringify(before.target) === JSON.stringify(after.target) && JSON.stringify(before.viewport) === JSON.stringify(after.viewport);
  const stabilityWarnings = timerVariance ? ["Pixels or accessibility text changed with unchanged source and inputs while application timers remain scheduled; capture stability is not established."] : [];
  return {
    ...metrics, diffPng: Buffer.from(png, "base64"), before, after, snapshotChanged,
    status: !before.complete || !after.complete || timerVariance ? "incomplete" : pixels.changedPixels || snapshotChanged ? "changed" : "unchanged",
    newErrors: after.errors.filter((e) => !before.errors.includes(e)),
    resolvedErrors: before.errors.filter((e) => !after.errors.includes(e)),
    newWarnings: [...after.warnings.filter((w) => !before.warnings.includes(w)), ...stabilityWarnings],
    resolvedWarnings: before.warnings.filter((w) => !after.warnings.includes(w)),
  };
}
