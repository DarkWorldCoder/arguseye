import { afterAll, beforeAll, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
import { openPreview } from "./openPreview.js";

/** A Preact project (preact, no react): Preact's JSX and render, providers from main.tsx, signals, global CSS. */
const root = path.resolve("test/fixtures/preact-app");
const at = (f: string) => path.join(root, "src/components", f);
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

it("renders hooks inside the provider main.tsx wraps the app in, and actions update state", async () => {
  const result = await renderer.render({ file: at("Counter.tsx"), exportName: "Counter", props: { start: 4 }, actions: [{ click: { role: "button" } }] });
  expect(result.errors).toEqual([]);
  expect(result.snapshot).toContain("Count 5 (ocean)");
});

it("renders @preact/signals", async () => {
  const result = await renderer.render({ file: at("SignalBadge.tsx") });
  expect(result.errors).toEqual([]);
  expect(result.snapshot).toContain("Cart: 3 items");
});

it("applies the global CSS main.tsx imports", async () => {
  const preview = await openPreview(root, { file: at("Counter.tsx"), exportName: "Counter", props: { start: 1 } });
  try {
    expect(preview.errors).toEqual([]);
    expect(await preview.style("body", "font-family")).toBe("Georgia, serif");
    expect(await preview.style(".counter", "color")).toBe("rgb(14, 116, 144)");
  } finally { await preview.close(); }
});

it("reports a render error", async () => {
  const result = await renderer.render({ file: at("Broken.tsx") });
  expect(result.errors.join("\n")).toContain("Preact component failed on purpose");
});
