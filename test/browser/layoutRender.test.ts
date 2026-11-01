import { afterAll, beforeAll, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

/** A root layout renders <html>/<body>, which React 19 takes over: the render must work and must not break the next one. */
const root = path.resolve("test/fixtures/next-app");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

it("renders a root layout on its own, then other components still render", async () => {
  const layout = await renderer.render({ file: path.join(root, "app/layout.tsx"), props: { children: "Page content here" } });
  expect(layout.errors).toEqual([]);
  expect(layout.snapshot).toContain("Page content here");
  for (let i = 0; i < 2; i++) {
    const nav = await renderer.render({ file: path.join(root, "components/Nav.tsx"), exportName: "Nav" });
    expect(nav.errors).toEqual([]);
    expect(nav.snapshot).toContain("Pricing");
  }
});
