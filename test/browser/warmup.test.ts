import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/react-app");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root, warmup: true }); });
afterAll(async () => renderer?.close());

describe("project-wide package warm-up", () => {
  it("bundles every package the project's source imports once, so no later render needs a reload", async () => {
    await renderer.ready();
    const first = await renderer.render({ file: path.join(root, "components/Alert.tsx"), exportName: "Alert", props: { title: "First" } });
    expect(first.errors).toEqual([]);
    // Greet needs esm-root-lib, which Alert's render never touched: already bundled by the warm-up.
    const second = await renderer.render({ file: path.join(root, "components/Greet.tsx"), exportName: "Greet", props: { name: "Ada" } });
    expect(second.errors).toEqual([]);
    expect(second.snapshot).toContain("Hello Ada!");
    expect(second.reloaded).toBe(false);
  });
});
