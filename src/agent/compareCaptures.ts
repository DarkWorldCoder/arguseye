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
  dimensions: { before: { width: number; height: number }; after: { width: number; height: number } };
  snapshotChanged: boolean;
  newErrors: string[];
  resolvedErrors: string[];
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
    let changedPixels = 0;
    for (let i = 0; i < old.data.length; i += 4) {
      const x = (i / 4) % width, y = Math.floor(i / 4 / width);
      const different = (x < aImg.width && y < aImg.height) !== (x < bImg.width && y < bImg.height) || [0, 1, 2, 3].some((c) => old.data[i + c] !== next.data[i + c]);
      if (different) { changedPixels++; next.data.set([230, 30, 110, 255], i); }
      else { const gray = Math.round((next.data[i] + next.data[i + 1] + next.data[i + 2]) / 3); next.data.set([gray, gray, gray, 100], i); }
    }
    ctx.putImageData(next, 0, 0);
    return { changedPixels, changedPercent: changedPixels / (width * height) * 100, png: canvas.toDataURL("image/png").split(",")[1], dimensions: { before: { width: aImg.width, height: aImg.height }, after: { width: bImg.width, height: bImg.height } } };
  }, [before.png.toString("base64"), after.png.toString("base64")]);
  const { png, ...metrics } = pixels;
  const snapshotChanged = before.snapshot !== after.snapshot;
  return {
    ...metrics, diffPng: Buffer.from(png, "base64"), before, after, snapshotChanged,
    status: !before.complete || !after.complete ? "incomplete" : pixels.changedPixels || snapshotChanged ? "changed" : "unchanged",
    newErrors: after.errors.filter((e) => !before.errors.includes(e)),
    resolvedErrors: before.errors.filter((e) => !after.errors.includes(e)),
  };
}
