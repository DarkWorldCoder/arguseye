import { afterAll, beforeAll, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/scroll-app");
const file = path.join(root, "Landing.tsx");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

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
