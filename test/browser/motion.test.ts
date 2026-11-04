import { afterAll, beforeAll, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/scroll-app");
const file = path.join(root, "Landing.tsx");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

it("visits real viewport and nested scroll reveals, replays the policy and reports bounded traversal", async () => {
  const target = { file: path.join(root, "Observed.tsx"), viewport: { width: 400, height: 600 } };
  const ordinary = await renderer.render(target);
  const revealed = await renderer.render({ ...target, capturePolicy: { scroll: {} } });
  expect(revealed.errors).toEqual([]);
  expect(revealed.scrollCapture).toMatchObject({ complete: true, restored: true });
  expect(revealed.scrollCapture!.visited.length).toBeGreaterThan(1);
  expect(revealed.png.equals(ordinary.png)).toBe(false);
  const replay = await renderer.diff(revealed.captureId!);
  expect(replay.changedPixels).toBe(0);
  expect(replay.after.target.capturePolicy).toEqual({ scroll: {} });
  const limited = await renderer.render({ ...target, capturePolicy: { scroll: { maxSteps: 1 } } });
  expect(limited.scrollCapture?.complete).toBe(false);
  expect(limited.complete).toBe(false);
  expect(limited.warnings.join()).toContain("Scroll traversal incomplete");
  const nested = await renderer.render({ ...target, props: { nested: true }, capturePolicy: { scroll: { selector: "[data-scroll-area]" } } });
  expect(nested.scrollCapture).toMatchObject({ complete: true, restored: true, selector: "[data-scroll-area]" });
  expect(nested.scrollCapture!.visited.at(-1)!.y).toBeGreaterThan(600);
  await expect(renderer.render({ ...target, capturePolicy: { scroll: { maxSteps: 1000 } } })).rejects.toThrow(/maxSteps/);
});

it("captures scroll-revealed content through reduced motion, with an explicit replayable opt-out", async () => {
  const still = await renderer.render({ file, props: { animated: false }, viewport: { width: 400, height: 600 } });
  const revealed = await renderer.render({ file, props: { animated: true }, viewport: { width: 400, height: 600 } });
  expect(revealed.errors).toEqual([]);
  expect(revealed.png.equals(still.png)).toBe(true);
  expect(revealed.environment).toMatchObject({ reducedMotion: "reduce" });
  const comparison = await renderer.diff(revealed.captureId!);
  expect(comparison.changedPixels).toBe(0);
  expect(comparison.after.environment).toMatchObject({ reducedMotion: "reduce" });

  const fixtures = { reducedMotion: "no-preference" as const };
  const scrolling = await renderer.render({ file, props: { animated: true }, fixtures, viewport: { width: 400, height: 600 } });
  expect(scrolling.errors).toEqual([]);
  expect(scrolling.png.equals(still.png)).toBe(false);
  expect(scrolling.environment).toMatchObject({ reducedMotion: "no-preference" });
  expect(scrolling.fixtureProvenance).toMatchObject(fixtures);
  const replay = await renderer.diff(scrolling.captureId!);
  expect(replay.after.target.fixtures).toEqual(fixtures);
  expect(replay.after.environment).toMatchObject(fixtures);

  const back = await renderer.render({ file, props: { animated: true }, viewport: { width: 400, height: 600 } });
  expect(back.png.equals(still.png)).toBe(true);
  expect(back.environment).toMatchObject({ reducedMotion: "reduce" });
});

it("decodes below-fold images before capturing regular and SVG foreignObject media", async () => {
  const target = { file: path.join(root, "ImagePage.tsx"), viewport: { width: 400, height: 600 } };
  const reference = await renderer.render({ ...target, props: { images: false } });
  const images = await renderer.render({ ...target, props: { images: true } });
  expect(images.errors).toEqual([]);
  expect(images.warnings.filter(w => w.startsWith("Assets did not settle:"))).toEqual([]);
  expect(images.png.equals(reference.png)).toBe(true);
  const broken = await renderer.render({ ...target, props: { images: true, broken: true } });
  expect(broken.errors).toEqual([]);
  expect(broken.warnings.join()).toContain("Assets did not settle: /missing.webp");
  expect(broken.complete).toBe(false);
});
