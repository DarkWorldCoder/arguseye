import { afterAll, beforeAll, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";
import { openPreview } from "./openPreview.js";

/** A Solid project: JSX compiled with its own babel-preset-solid, Solid's render, providers from index.tsx. */
const root = path.resolve("test/fixtures/solid-app");
const at = (f: string) => path.join(root, "src/components", f);
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

it("renders signals inside the provider index.tsx wraps the app in, and actions update them", async () => {
  const result = await renderer.render({ file: at("Counter.tsx"), exportName: "Counter", props: { start: 4 }, actions: [{ click: { role: "button" } }] });
  expect(result.errors).toEqual([]);
  expect(result.snapshot).toContain("Count 5 (forest)");
});

it("renders Show, For and a resource once it resolves", async () => {
  const result = await renderer.render({ file: at("TodoList.tsx"), props: { title: "Today" } });
  expect(result.errors).toEqual([]);
  expect(result.snapshot).toContain("Today");
  expect(result.snapshot).toContain("Write tests");
});

it("applies the global CSS index.tsx imports", async () => {
  const preview = await openPreview(root, { file: at("Counter.tsx"), exportName: "Counter", props: { start: 1 } });
  try {
    expect(preview.errors).toEqual([]);
    expect(await preview.style("body", "font-family")).toBe("Georgia, serif");
    expect(await preview.style(".count", "color")).toBe("rgb(14, 116, 144)");
  } finally { await preview.close(); }
});

it("reports a render error", async () => {
  const result = await renderer.render({ file: at("Broken.tsx") });
  expect(result.errors.join("\n")).toContain("Solid component failed on purpose");
});
