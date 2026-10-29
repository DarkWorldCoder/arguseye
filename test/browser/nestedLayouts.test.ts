import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { createRenderer, type Renderer } from "../../src/agent/createRenderer.js";

const root = path.resolve("test/fixtures/next-app");
const badge = path.join(root, "components/DealBadge.tsx");
let renderer: Renderer;
beforeAll(async () => { renderer = await createRenderer({ root }); });
afterAll(async () => renderer?.close());

describe("nested layouts and templates along the page's route", () => {
  it("wraps a component in every layout and template from app/ down to the page that uses it", async () => {
    const result = await renderer.render({ file: badge, exportName: "DealBadge", usage: "app/(shop)/deals/page.tsx:4" });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Today: 15% off");
    expect(result.layoutsApplied).toEqual(["app/layout.tsx", "app/(shop)/layout.tsx", "app/(shop)/template.tsx"]);
  });

  it("uses the route of the first page that uses the component when no usage is given", async () => {
    const result = await renderer.render({ file: badge, exportName: "DealBadge", props: { label: "Any" } });
    expect(result.errors).toEqual([]);
    expect(result.snapshot).toContain("Any: 15% off");
  });
});
